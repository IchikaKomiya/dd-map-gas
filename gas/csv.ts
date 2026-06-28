// 公開マスタ → CSV 文字列
// RFC 4180 準拠（CRLF、ダブルクォートエスケープ）
// CSV_EXCLUDE_COLUMNS のカラムは出力しない（例: suggestions は内部のみ）

function escapeCsvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  let s: string;
  if (v instanceof Date) {
    s = Utilities.formatDate(v, "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
  } else {
    s = String(v);
  }
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildPublishCsv(): string {
  const sheet = getSheetOrThrow(SHEET_PUBLISH);
  const rows = readTableRows(sheet);
  // 出力対象カラム = COLUMNS - CSV_EXCLUDE_COLUMNS
  const headers = (COLUMNS as readonly string[]).filter((c) => !CSV_EXCLUDE_COLUMNS.has(c));
  const headerLine = headers.map(escapeCsvCell).join(",");
  if (rows.length === 0) return headerLine + "\r\n";
  const dataLines = rows.map((r) => headers.map((h) => escapeCsvCell(r[h])).join(","));
  return [headerLine, ...dataLines].join("\r\n") + "\r\n";
}
