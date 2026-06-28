// 承認フロー
// - addToApproval(): 入力フォームの内容を承認用シートに1行追記し、フォームをクリア
// - publishApproved(): 承認用シートで approved=TRUE の行を 公開マスタへ upsert + 承認用から削除

// レコード（{カラム名: 値}）を承認用シートへ upsert（メニュー/Web API 共通）
// 返り値: insert/update の別
function addRecordToApproval(record: Record<string, unknown>): { mode: "insert" | "update" } {
  if (!record.id) {
    throw new Error("idが未取得です。先にURLからスポット情報を取得してください。");
  }
  if (!record.description) {
    throw new Error("説明・概要（description）は必須です。");
  }

  const appSheet = getSheetOrThrow(SHEET_APPROVAL);
  const appCols = getColumnMap(appSheet);

  // 重複idは既存の承認用行を上書き
  const existingRows = readTableRows(appSheet);
  const existingIndex = existingRows.findIndex((r) => String(r.id || "") === String(record.id));
  const targetRow = existingIndex >= 0 ? existingIndex + 2 : appSheet.getLastRow() + 1;

  const headers = appSheet.getRange(1, 1, 1, appSheet.getLastColumn()).getValues()[0] as string[];
  const row = headers.map((h) => {
    if (h === "submitted_at") return new Date();
    if (h === "approved") return false;
    if (h === "approved_at" || h === "approved_by") return "";
    if (h === "confirmed_at") return new Date();
    return record[h] ?? "";
  });
  appSheet.getRange(targetRow, 1, 1, headers.length).setValues([row]);

  // approved列にチェックボックス
  const approvedCol = appCols["approved"];
  if (approvedCol) {
    appSheet.getRange(targetRow, approvedCol).insertCheckboxes();
  }

  const mode = existingIndex >= 0 ? "update" : "insert";
  logEvent("INFO", "addRecordToApproval", `id=${record.id} mode=${mode}`);
  return { mode };
}

function addToApproval(): void {
  const form = readForm();
  let result: { mode: "insert" | "update" };
  try {
    result = addRecordToApproval(form);
  } catch (e) {
    SpreadsheetApp.getUi().alert((e as Error).message);
    return;
  }

  clearForm();
  SpreadsheetApp.getActive().toast(
    result.mode === "update"
      ? "既存の承認用エントリを更新しました。"
      : "承認用シートに追加しました。",
    "dd-map",
    5,
  );
}

// 承認済み行を 公開マスタへ upsert（id一致で上書き、無ければ追加）
function upsertToPublishMaster(approvedRows: Array<Record<string, unknown>>): void {
  const pubSheet = getSheetOrThrow(SHEET_PUBLISH);
  const headers = COLUMNS as readonly string[];

  // 既存の 公開マスタ から id→シート行番号 のマップを作る
  const existingRows = readTableRows(pubSheet);
  const idToRow: Record<string, number> = {};
  existingRows.forEach((r, i) => {
    const id = String(r.id || "");
    if (id) idToRow[id] = i + 2;
  });

  for (const row of approvedRows) {
    const id = String(row.id || "");
    if (!id) continue;
    const values = headers.map((h) => row[h] ?? "");
    if (idToRow[id]) {
      pubSheet.getRange(idToRow[id], 1, 1, headers.length).setValues([values]);
    } else {
      const newRow = pubSheet.getLastRow() + 1;
      pubSheet.getRange(newRow, 1, 1, headers.length).setValues([values]);
      idToRow[id] = newRow;
    }
  }
}

// 承認用シートから approved=TRUE 行を削除（下から削除して行ずれを回避）
function deleteApprovedRows(): number {
  const appSheet = getSheetOrThrow(SHEET_APPROVAL);
  const appCols = getColumnMap(appSheet);
  const approvedCol = appCols["approved"];
  if (!approvedCol) return 0;

  const lastRow = appSheet.getLastRow();
  if (lastRow < 2) return 0;

  const data = appSheet.getRange(2, 1, lastRow - 1, appSheet.getLastColumn()).getValues();
  let deleted = 0;
  for (let i = data.length - 1; i >= 0; i--) {
    if (data[i][approvedCol - 1] === true) {
      appSheet.deleteRow(i + 2);
      deleted++;
    }
  }
  return deleted;
}

// 指定idの承認用行に approved=TRUE を立てて公開マスタへ反映（Web API admin 用）
// ids が空なら、既にチェック済みの行だけを反映（メニューと同等）
function approveIdsAndPublish(ids: string[]): { upserted: number; removed: number } {
  if (ids && ids.length > 0) {
    const appSheet = getSheetOrThrow(SHEET_APPROVAL);
    const appCols = getColumnMap(appSheet);
    const approvedCol = appCols["approved"];
    const idCol = appCols["id"];
    if (!approvedCol || !idCol) throw new Error("承認用シートの列構成が不正です。");

    const idSet: Record<string, boolean> = {};
    for (const id of ids) idSet[String(id)] = true;

    const lastRow = appSheet.getLastRow();
    for (let r = 2; r <= lastRow; r++) {
      const id = String(appSheet.getRange(r, idCol).getValue() || "");
      if (idSet[id]) appSheet.getRange(r, approvedCol).setValue(true);
    }
  }
  return publishApprovedCore();
}

// 承認済み行を公開マスタへ反映（メニュー/Web API 共通）。返り値: 件数
function publishApprovedCore(): { upserted: number; removed: number } {
  const appSheet = getSheetOrThrow(SHEET_APPROVAL);
  // 公開マスタの存在チェック（ensureTableSheet済みなはず）
  getSheetOrThrow(SHEET_PUBLISH);

  const approvedRows = readTableRows(appSheet).filter((r) => r["approved"] === true && r["id"]);
  if (approvedRows.length === 0) {
    return { upserted: 0, removed: 0 };
  }

  upsertToPublishMaster(approvedRows);
  const removed = deleteApprovedRows();

  logEvent("INFO", "publishApprovedCore", `upserted=${approvedRows.length} removed=${removed}`);
  return { upserted: approvedRows.length, removed };
}

function publishApproved(): void {
  const result = publishApprovedCore();
  if (result.upserted === 0) {
    SpreadsheetApp.getUi().alert("承認済み（approvedチェック済み）の行がありません。");
    return;
  }
  SpreadsheetApp.getUi().alert(
    `${result.upserted}件を公開マスタへ反映し、承認用から削除しました。\n続けて「GitHubへ data.csv を push」を実行してください。`,
  );
}
