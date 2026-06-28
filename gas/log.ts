// ログシートへの記録（GASのStackdriverと併用）

function logEvent(level: "INFO" | "WARN" | "ERROR", event: string, detail: string): void {
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_LOG);
    if (!sheet) {
      console.log(`[${level}] ${event}: ${detail}`);
      return;
    }
    sheet.appendRow([new Date(), level, event, detail]);
  } catch (_e) {
    console.log(`[${level}] ${event}: ${detail}`);
  }
}
