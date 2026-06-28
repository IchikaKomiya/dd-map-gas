// シート初期化 + フォーム/テーブルのアクセスヘルパー

function setupSheets(): void {
  const ss = SpreadsheetApp.getActive();
  setupInputForm(ss);
  ensureTableSheet(ss, SHEET_APPROVAL, [...COLUMNS, ...APPROVAL_EXTRA_COLUMNS]);
  ensureTableSheet(ss, SHEET_PUBLISH, [...COLUMNS]);
  ensureTableSheet(ss, SHEET_LOG, ["timestamp", "level", "event", "detail"]);
  SpreadsheetApp.getActive().toast("初期セットアップ完了。シートを確認してください。", "dd-map");
}

// 入力シート（単票フォーム）の初期化
function setupInputForm(ss: GoogleAppsScript.Spreadsheet.Spreadsheet): void {
  let sheet = ss.getSheetByName(SHEET_INPUT);
  if (!sheet) sheet = ss.insertSheet(SHEET_INPUT);
  sheet.clear();
  sheet.clearConditionalFormatRules();

  // 列幅
  sheet.setColumnWidth(FORM_COL.LABEL, 140);
  sheet.setColumnWidth(FORM_COL.VALUE, 360);
  sheet.setColumnWidth(FORM_COL.BUTTON, 130); // ボタン列
  sheet.setColumnWidth(FORM_COL.COMP_LABEL, 140);
  sheet.setColumnWidth(FORM_COL.COMP_VALUE, 360);

  // タイトル
  sheet.getRange(FORM_ROW.__title, 1, 1, 5).merge();
  sheet
    .getRange(FORM_ROW.__title, 1)
    .setValue("dd-map スポット入力フォーム")
    .setFontSize(14)
    .setFontWeight("bold")
    .setBackground("#1a73e8")
    .setFontColor("#ffffff")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(FORM_ROW.__title, 32);

  // URL入力行 + 取得ボタン
  setLabel(sheet, FORM_ROW.url_maps, "url_maps", true);
  sheet
    .getRange(FORM_ROW.url_maps, FORM_COL.VALUE)
    .setBackground("#fff8e1")
    .setBorder(true, true, true, true, false, false)
    .setWrap(true)
    .setVerticalAlignment("top");
  installButton(sheet, FORM_BTN.FETCH_ROW, "▶ 取得", "#1a73e8");

  // セクションヘッダー: API取得結果
  sheet.getRange(FORM_ROW.__auto_header, FORM_COL.LABEL, 1, 2).merge();
  sheet
    .getRange(FORM_ROW.__auto_header, FORM_COL.LABEL)
    .setValue("─── API取得結果（自動）───")
    .setFontWeight("bold")
    .setFontColor("#555")
    .setBackground("#f5f5f5");
  sheet.getRange(FORM_ROW.__auto_header, FORM_COL.COMP_LABEL, 1, 2).merge();
  sheet
    .getRange(FORM_ROW.__auto_header, FORM_COL.COMP_LABEL)
    .setValue("─── 既存スポット（比較）───")
    .setFontWeight("bold")
    .setFontColor("#555")
    .setBackground("#f5f5f5");

  for (const field of AUTO_FIELDS) {
    setLabel(sheet, FORM_ROW[field], field, false);
    const valCell = sheet.getRange(FORM_ROW[field], FORM_COL.VALUE);
    valCell
      .setBackground("#fafafa")
      .setFontColor("#444")
      .setWrap(true)
      .setVerticalAlignment("top");
    if (MULTILINE_FIELDS.has(field)) {
      sheet.setRowHeight(FORM_ROW[field], 120);
    }
  }

  // セクションヘッダー: 手入力
  sheet.getRange(FORM_ROW.__manual_header, FORM_COL.LABEL, 1, 2).merge();
  sheet
    .getRange(FORM_ROW.__manual_header, FORM_COL.LABEL)
    .setValue("─── 手入力 ───")
    .setFontWeight("bold")
    .setFontColor("#555")
    .setBackground("#f5f5f5");

  for (const field of MANUAL_FIELDS) {
    setLabel(sheet, FORM_ROW[field], field, true);
    const valCell = sheet.getRange(FORM_ROW[field], FORM_COL.VALUE);
    valCell
      .setBackground("#fff8e1")
      .setBorder(true, true, true, true, false, false)
      .setWrap(true)
      .setVerticalAlignment("top");
    if (MULTILINE_FIELDS.has(field)) {
      sheet.setRowHeight(FORM_ROW[field], 80);
    }
  }

  // 追加ボタン
  installButton(sheet, FORM_BTN.ADD_ROW, "▶ 承認用へ追加", "#188038");

  // 比較カラムのラベル
  for (const field of COMPARE_FIELDS) {
    if (FORM_ROW[field]) {
      const ja = FIELD_LABEL_JA[field] ?? field;
      sheet
        .getRange(FORM_ROW[field], FORM_COL.COMP_LABEL)
        .setValue(`${ja}（${field}）`)
        .setFontColor("#888")
        .setFontSize(10)
        .setVerticalAlignment("top");
      sheet
        .getRange(FORM_ROW[field], FORM_COL.COMP_VALUE)
        .setFontColor("#666")
        .setWrap(true)
        .setVerticalAlignment("top");
    }
  }

  sheet.setFrozenRows(2);

  // 操作案内（ADD_ROW=26の下、間に空行を挟む）
  const helpRow = 28;
  sheet.getRange(helpRow, 1, 1, 5).merge();
  sheet
    .getRange(helpRow, 1)
    .setValue('操作: URL貼付 → 右の「▶ 取得」にチェック → 比較確認 → 「▶ 承認用へ追加」にチェック')
    .setFontColor("#666")
    .setBackground("#e8f0fe")
    .setHorizontalAlignment("center");
  sheet.setRowHeight(helpRow, 28);

  // onEdit トリガー設置
  installTriggers();
}

// チェックボックスをボタン代わりに設置（B列にラベル、C列にチェックボックス）
function installButton(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  row: number,
  label: string,
  color: string,
): void {
  // B列: ラベル
  sheet
    .getRange(row, FORM_COL.VALUE)
    .setValue(label)
    .setBackground(color)
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(12)
    .setHorizontalAlignment("right")
    .setVerticalAlignment("middle")
    .setBorder(null, null, null, null, false, false);
  // C列: チェックボックス
  const cb = sheet.getRange(row, FORM_COL.BUTTON);
  cb.insertCheckboxes();
  cb.setValue(false);
  cb.setBackground(color)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setNote(`チェックすると「${label.replace("▶ ", "")}」が実行されます`);
  sheet.setRowHeight(row, 34);
}

function setLabel(
  sheet: GoogleAppsScript.Spreadsheet.Sheet,
  row: number,
  field: string,
  required: boolean,
): void {
  const ja = FIELD_LABEL_JA[field];
  const label = ja ? `${ja}（${field}）` : field;
  sheet
    .getRange(row, FORM_COL.LABEL)
    .setValue(required ? `${label} *` : label)
    .setFontWeight("bold")
    .setBackground("#eeeeee")
    .setVerticalAlignment("middle")
    .setWrap(true);
  sheet.setRowHeight(row, 26);
}

function ensureTableSheet(
  ss: GoogleAppsScript.Spreadsheet.Spreadsheet,
  name: string,
  headers: readonly string[],
): GoogleAppsScript.Spreadsheet.Sheet {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  const range = sheet.getRange(1, 1, 1, headers.length);
  const current = range.getValues()[0] as string[];
  const needWrite = headers.some((h, i) => current[i] !== h);
  if (needWrite) {
    range.setValues([headers as string[]]);
    range.setFontWeight("bold").setBackground("#f0f0f0");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSheetOrThrow(name: string): GoogleAppsScript.Spreadsheet.Sheet {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found. メニュー→初期セットアップを実行してください。`);
  return sheet;
}

// テーブルシート用: ヘッダー行 → {カラム名: 列番号(1始まり)}
function getColumnMap(sheet: GoogleAppsScript.Spreadsheet.Sheet): Record<string, number> {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) return {};
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0] as string[];
  const map: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h) map[h] = i + 1;
  });
  return map;
}

// テーブルシート全体を {カラム名: 値} のオブジェクト配列で読み出し
function readTableRows(sheet: GoogleAppsScript.Spreadsheet.Sheet): Array<Record<string, unknown>> {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol === 0) return [];
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0] as string[];
  const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) obj[h] = row[i];
    });
    return obj;
  });
}

// 入力フォームの読み書き
function readForm(): Record<string, unknown> {
  const sheet = getSheetOrThrow(SHEET_INPUT);
  const result: Record<string, unknown> = {};
  result.url_maps = sheet.getRange(FORM_ROW.url_maps, FORM_COL.VALUE).getValue();
  for (const f of AUTO_FIELDS) {
    result[f] = sheet.getRange(FORM_ROW[f], FORM_COL.VALUE).getValue();
  }
  for (const f of MANUAL_FIELDS) {
    result[f] = sheet.getRange(FORM_ROW[f], FORM_COL.VALUE).getValue();
  }
  return result;
}

function writeFormField(field: string, value: unknown): void {
  const row = FORM_ROW[field];
  if (!row) return;
  const sheet = getSheetOrThrow(SHEET_INPUT);
  sheet.getRange(row, FORM_COL.VALUE).setValue(value as string | number | Date);
}

function clearForm(): void {
  const sheet = getSheetOrThrow(SHEET_INPUT);
  // URL + 自動取得 + 手入力 + 比較カラム すべてクリア
  sheet.getRange(FORM_ROW.url_maps, FORM_COL.VALUE).clearContent();
  for (const f of AUTO_FIELDS) {
    sheet.getRange(FORM_ROW[f], FORM_COL.VALUE).clearContent();
  }
  for (const f of MANUAL_FIELDS) {
    sheet.getRange(FORM_ROW[f], FORM_COL.VALUE).clearContent();
  }
  clearCompareColumn();
}

function clearCompareColumn(): void {
  const sheet = getSheetOrThrow(SHEET_INPUT);
  for (const f of COMPARE_FIELDS) {
    if (FORM_ROW[f]) {
      sheet.getRange(FORM_ROW[f], FORM_COL.COMP_VALUE).clearContent();
      // 黄色ハイライトも解除
      sheet.getRange(FORM_ROW[f], FORM_COL.COMP_LABEL, 1, 2).setBackground(null);
    }
  }
}
