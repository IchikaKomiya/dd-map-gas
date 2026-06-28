// エントリポイント・カスタムメニュー・イベントハンドラ

function onOpen(): void {
  SpreadsheetApp.getUi()
    .createMenu("dd-map")
    .addItem("初期セットアップ（シート作成）", "setupSheets")
    .addItem("シークレット設定", "setupSecrets")
    .addSeparator()
    .addItem("① URLから取得", "fetchToForm")
    .addItem("② 承認用へ追加（入力をクリア）", "addToApproval")
    .addItem("  フォームをクリア", "clearForm")
    .addSeparator()
    .addItem("承認済み行を公開マスタへ反映", "publishApproved")
    .addItem("GitHubへ data.csv を push", "pushToGitHub")
    .addSeparator()
    .addItem("ボタン用トリガー再設置", "installTriggers")
    .addToUi();
}

// 入力シート上のチェックボックスをボタンとして動作させる
function onEditInstallable(e: GoogleAppsScript.Events.SheetsOnEdit): void {
  try {
    const range = e.range;
    if (range.getSheet().getName() !== SHEET_INPUT) return;
    if (range.getColumn() !== FORM_COL.BUTTON) return;
    // チェックON時のみ（OFFや他の編集は無視）。e.value は "TRUE" 文字列
    if (e.value !== "TRUE") return;

    const row = range.getRow();
    // 即座にチェックを外す（次の操作に備える + 連続発火防止）
    range.setValue(false);

    if (row === FORM_BTN.FETCH_ROW) {
      fetchToForm();
    } else if (row === FORM_BTN.ADD_ROW) {
      addToApproval();
    }
  } catch (err) {
    const msg = (err as Error).message;
    SpreadsheetApp.getActive().toast(`エラー: ${msg}`, "dd-map", 10);
    logEvent("ERROR", "onEditInstallable", msg);
  }
}

// installable onEdit トリガーを設置（初期セットアップから自動呼び出し）
function installTriggers(): void {
  const ss = SpreadsheetApp.getActive();
  const existing = ScriptApp.getProjectTriggers();
  for (const t of existing) {
    if (t.getHandlerFunction() === "onEditInstallable") {
      ScriptApp.deleteTrigger(t);
    }
  }
  ScriptApp.newTrigger("onEditInstallable")
    .forSpreadsheet(ss)
    .onEdit()
    .create();
  ss.toast("ボタン用トリガーを設置しました。", "dd-map", 5);
}
