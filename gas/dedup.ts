// 重複検知 + 入力フォーム右カラムへの比較表示

function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

// 入力フォームの id / lat / lng に対し、承認用+公開マスタから一致する既存スポットを返す
function findExistingMatch(): Record<string, unknown> | null {
  const form = readForm();
  return findExistingMatchFor(form.id, form.lat, form.lng);
}

// id / lat / lng を直接受け取る版（メニュー/Web API 共通）
function findExistingMatchFor(
  rawId: unknown,
  rawLat: unknown,
  rawLng: unknown,
): Record<string, unknown> | null {
  const inputId = String(rawId || "");
  const lat = Number(rawLat);
  const lng = Number(rawLng);

  const candidates: Array<Record<string, unknown>> = [];
  const appSheet = SpreadsheetApp.getActive().getSheetByName(SHEET_APPROVAL);
  if (appSheet) candidates.push(...readTableRows(appSheet));
  const pubSheet = SpreadsheetApp.getActive().getSheetByName(SHEET_PUBLISH);
  if (pubSheet) candidates.push(...readTableRows(pubSheet));

  // 1) id 完全一致を最優先
  if (inputId) {
    const hit = candidates.find((r) => String(r.id || "") === inputId);
    if (hit) return hit;
  }
  // 2) 座標近接（DEDUP_DISTANCE_M 以内）。最も近いものを返す
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    let best: { row: Record<string, unknown>; dist: number } | null = null;
    for (const r of candidates) {
      const rLat = Number(r.lat);
      const rLng = Number(r.lng);
      if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;
      const d = haversineMeters(lat, lng, rLat, rLng);
      if (d <= DEDUP_DISTANCE_M && (!best || d < best.dist)) {
        best = { row: r, dist: d };
      }
    }
    if (best) return best.row;
  }
  return null;
}

// 比較用の正規化（型の差を吸収）
function normalizeForCompare(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return Utilities.formatDate(v, "Asia/Tokyo", "yyyy-MM-dd");
  if (typeof v === "number") return String(v);
  return String(v).trim();
}

function showDuplicate(): void {
  const sheet = getSheetOrThrow(SHEET_INPUT);
  clearCompareColumn(); // ハイライトもクリア
  const match = findExistingMatch();
  if (!match) {
    sheet.getRange(FORM_ROW.id, FORM_COL.COMP_VALUE).setValue("（重複なし）").setFontColor("#0a0");
    return;
  }

  const form = readForm();
  let diffCount = 0;
  for (const f of COMPARE_FIELDS) {
    const row = FORM_ROW[f];
    if (!row) continue;
    const newVal = normalizeForCompare(form[f]);
    const oldVal = normalizeForCompare(match[f]);
    // 既存値をセル E に表示
    sheet.getRange(row, FORM_COL.COMP_VALUE).setValue(match[f] ?? "");
    // ハイライト条件: 既存が空でない かつ 新値と異なる
    if (oldVal !== "" && newVal !== oldVal) {
      sheet.getRange(row, FORM_COL.COMP_LABEL, 1, 2).setBackground("#fff3bf");
      diffCount++;
    }
  }
  SpreadsheetApp.getActive().toast(
    `⚠ 既存スポットと重複の可能性あり（差分 ${diffCount} 件）。右側で確認してください。`,
    "dd-map",
    7,
  );
}
