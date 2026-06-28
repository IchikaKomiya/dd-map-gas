// シート名・カラム定義・フォームレイアウトの一元管理

const SHEET_INPUT = "入力";
const SHEET_APPROVAL = "承認用";
const SHEET_PUBLISH = "公開マスタ";
const SHEET_LOG = "ログ";

// 公開マスタ / 承認用 の共通カラム順（CSV出力時は CSV_COLUMNS でフィルタする）
const COLUMNS = [
  "id",
  "spot_name",
  "category",
  "types",
  "address",
  "tel",
  "opening_hours",
  "url_official",
  "url_maps",
  "lat",
  "lng",
  "plus_code",
  "description",
  "rating",
  "reviews_count",
  "confirmed_at",
  "notes",
  "suggestions",
] as const;

// GitHubへ公開するCSVから除外するカラム（Drive上の公開マスタには保持）
const CSV_EXCLUDE_COLUMNS = new Set<string>(["suggestions"]);

const APPROVAL_EXTRA_COLUMNS = [
  "submitted_by",
  "submitted_at",
  "approved",
  "approved_by",
  "approved_at",
] as const;

// 入力シート = 単票フォーム
// A列=ラベル, B列=値, C列=ボタン(チェックボックス), D列=比較ラベル, E列=比較値
const FORM_COL = {
  LABEL: 1, // A
  VALUE: 2, // B
  BUTTON: 3, // C
  COMP_LABEL: 4, // D
  COMP_VALUE: 5, // E
} as const;

// ボタン行
const FORM_BTN = {
  FETCH_ROW: 4, // URL行の直下
  ADD_ROW: 26, // 投稿者の下
} as const;

// フィールド名 → 行番号 のマップ
const FORM_ROW: Record<string, number> = {
  __title: 1,
  url_maps: 3,
  __auto_header: 5,
  id: 6,
  spot_name: 7,
  category: 8,
  types: 9,
  address: 10,
  tel: 11,
  opening_hours: 12,
  url_official: 13,
  lat: 14,
  lng: 15,
  plus_code: 16,
  rating: 17,
  reviews_count: 18,
  __manual_header: 20,
  description: 21,
  notes: 22,
  suggestions: 23,
  submitted_by: 24,
};

// API取得で埋めるフィールド（順序は表示順）
const AUTO_FIELDS = [
  "id",
  "spot_name",
  "category",
  "types",
  "address",
  "tel",
  "opening_hours",
  "url_official",
  "lat",
  "lng",
  "plus_code",
  "rating",
  "reviews_count",
] as const;

// 手入力フィールド
const MANUAL_FIELDS = ["description", "notes", "suggestions", "submitted_by"] as const;

// 高さを大きく取りたいフィールド（複数行表示）
const MULTILINE_FIELDS = new Set(["opening_hours", "description", "notes", "suggestions"]);

// フィールド名 → 日本語ラベル（表示用、内部キーはCOLUMNSの英名のまま）
const FIELD_LABEL_JA: Record<string, string> = {
  id: "ID",
  spot_name: "スポット名",
  category: "カテゴリ",
  types: "タイプ",
  address: "住所",
  tel: "電話",
  opening_hours: "営業時間",
  url_official: "公式サイト",
  url_maps: "GoogleマップURL",
  lat: "緯度",
  lng: "経度",
  plus_code: "Plus Code",
  description: "説明・概要",
  rating: "評価",
  reviews_count: "クチコミ数",
  confirmed_at: "確認日",
  notes: "備考",
  suggestions: "改善案",
  submitted_by: "投稿者",
};

// 比較表示するフィールド（既存スポット）= 自動取得+手入力フィールド全て
const COMPARE_FIELDS = [
  "id",
  "spot_name",
  "category",
  "types",
  "address",
  "tel",
  "opening_hours",
  "url_official",
  "lat",
  "lng",
  "plus_code",
  "rating",
  "reviews_count",
  "description",
  "notes",
  "suggestions",
  "submitted_by",
] as const;

// PropertiesService のキー
const PROP_KEYS = {
  PLACES_API_KEY: "PLACES_API_KEY",
  GITHUB_TOKEN: "GITHUB_TOKEN",
  GITHUB_OWNER: "GITHUB_OWNER",
  GITHUB_REPO: "GITHUB_REPO",
  GITHUB_BRANCH: "GITHUB_BRANCH",
  GITHUB_PATH: "GITHUB_PATH",
  // Web App 認証
  USER_PASSWORD: "USER_PASSWORD",
  ADMIN_PASSWORD: "ADMIN_PASSWORD",
  AUTH_SECRET: "AUTH_SECRET", // トークン署名用の秘密鍵（十分長いランダム文字列）
} as const;

// ロール定義
type Role = "user" | "admin";

// 認証トークンの有効期限（時間）
const TOKEN_TTL_HOURS = 12;

// Web フォームから submit を許可するフィールド（自動取得 + 手入力 + URL）。
// これ以外のキー（approved 等）はサーバ側で無視・上書きする。
const SUBMITTABLE_FIELDS = [...AUTO_FIELDS, ...MANUAL_FIELDS, "url_maps"] as const;

// 重複判定の距離しきい値（メートル）
const DEDUP_DISTANCE_M = 50;
