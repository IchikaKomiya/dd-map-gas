// フィールド定義（gas/config.ts と対応。GASのモジュール制約上、最小重複で共有）

export interface FieldDef {
  key: string;
  label: string;
  multiline?: boolean;
  required?: boolean;
  note?: string; // ラベル下に出す補足説明
}

// API（Places）が自動取得するフィールド（基本的に編集不可で確認用）
export const AUTO_FIELDS: FieldDef[] = [
  { key: "id", label: "ID" },
  { key: "spot_name", label: "スポット名" },
  { key: "category", label: "カテゴリ" },
  { key: "types", label: "タイプ" },
  { key: "address", label: "住所" },
  { key: "tel", label: "電話" },
  { key: "opening_hours", label: "営業時間", multiline: true },
  { key: "url_official", label: "公式サイト" },
  { key: "lat", label: "緯度" },
  { key: "lng", label: "経度" },
  { key: "plus_code", label: "Plus Code" },
  { key: "rating", label: "評価" },
  { key: "reviews_count", label: "クチコミ数" },
];

// 投稿者が手入力するフィールド
export const MANUAL_FIELDS: FieldDef[] = [
  {
    key: "description",
    label: "説明・概要",
    multiline: true,
    required: true,
    note: "Googleマップから取得した内容です。必要に応じて加筆・修正してください。",
  },
  { key: "notes", label: "備考", multiline: true },
  { key: "suggestions", label: "改善案", multiline: true },
  { key: "submitted_by", label: "投稿者名", required: true },
];

// 重複比較で表示するフィールド
export const COMPARE_FIELDS: FieldDef[] = [...AUTO_FIELDS, ...MANUAL_FIELDS].filter(
  (f) => f.key !== "submitted_by",
);

// key → FieldDef の索引（登録画面の並び替え用）
const FIELD_BY_KEY: Record<string, FieldDef> = {};
for (const f of [...AUTO_FIELDS, ...MANUAL_FIELDS]) FIELD_BY_KEY[f.key] = f;
const pick = (keys: string[]): FieldDef[] => keys.map((k) => FIELD_BY_KEY[k]);

// 登録の確認画面：ユーザーが主に確認・編集する項目（上に表示、操作順）
export const REGISTER_PRIMARY_FIELDS: FieldDef[] = pick([
  "spot_name",
  "address",
  "tel",
  "opening_hours",
  "url_official",
  "description",
  "notes",
  "suggestions",
  "submitted_by",
]);

// 基本的に変更しない項目（下にまとめて表示）
export const REGISTER_SECONDARY_FIELDS: FieldDef[] = pick([
  "category",
  "types",
  "lat",
  "lng",
  "plus_code",
  "rating",
  "reviews_count",
  "id",
]);

// 管理画面の一覧テーブルで表示するカラム（承認待ち＝承認用シート）
export const ADMIN_LIST_COLUMNS = [
  "id",
  "spot_name",
  "category",
  "address",
  "description",
  "submitted_by",
  "submitted_at",
];

// 登録済み一覧（公開マスタ）で表示するカラム。
// 公開マスタには submitted_by/submitted_at は無く、confirmed_at を持つ。
export const ADMIN_PUBLISH_COLUMNS = [
  "id",
  "spot_name",
  "category",
  "address",
  "description",
  "confirmed_at",
];

export type SpotRecord = Record<string, unknown>;
