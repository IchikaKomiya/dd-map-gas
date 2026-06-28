# dd-map（観光スポット オープンデータ 管理・公開システム）

スポット登録を **Webアプリ**（登録フォーム + 管理画面）で行い、データは引き続き
**Googleスプレッドシート** に蓄積、承認後に **GitHub の `data.csv`** へ公開するモノレポ。

```
┌─────────────┐   text/plain POST    ┌──────────────────┐   read/write   ┌─────────────┐
│  web/  (SPA) │ ───────────────────▶ │ gas/ (Web App API)│ ─────────────▶ │ スプレッドシート │
│ GitHub Pages │ ◀─────────────────── │  doGet / doPost   │                │  （DB）       │
│ / localhost  │       JSON           │  + パスワード認証   │                └─────────────┘
└─────────────┘                       └──────────────────┘ ── PUT ──▶ GitHub data.csv
```

- **バックエンド** = GAS Web App（`doGet`/`doPost` の JSON API）。新規サーバー不要。
- **DB** = 同じスプレッドシート。Places API 補完・承認・GitHub push の既存ロジックを再利用。
- **認証** = ロール別の共有パスワード（一般ユーザー用 / 管理者用）。一般は登録のみ、管理者は承認・公開も可能。
- **ローカルも本番も同じスプレッドシート宛**（同一の GAS Web App URL を叩く）。

仕様: `../dd-map/spec.md`

## ディレクトリ構成

```
.
├── gas/                  Google Apps Script（バックエンド）
│   ├── appsscript.json   マニフェスト（webapp 設定含む）
│   ├── config.ts         シート名 / カラム / 認証キー定義
│   ├── secrets.ts        PropertiesService ラッパー + setupSecrets
│   ├── sheets.ts         シート初期化・アクセス
│   ├── places.ts         Places API 連携（placeDetailsToRecord 等）
│   ├── dedup.ts          重複検知（findExistingMatchFor）
│   ├── approval.ts       承認フロー（addRecordToApproval / publishApprovedCore）
│   ├── csv.ts  github.ts log.ts  CSV化 / GitHub push / ログ
│   ├── main.ts           スプレッドシート用カスタムメニュー（従来動作も維持）
│   └── api.ts            Web App JSON API + 認証
├── web/                  登録フォーム / 管理画面（React + Vite + TS）
│   └── src/
│       ├── api.ts auth.tsx fields.ts
│       └── pages/  Login.tsx  Register.tsx  Admin.tsx
├── .github/workflows/deploy-pages.yml   web/ を GitHub Pages へ
├── pnpm-workspace.yaml   ルート(gas tooling) + web のワークスペース
├── .clasp.json           rootDir = ./gas
└── tsconfig.json         gas/ の型チェック
```

## セットアップ

### 0. 依存インストール（ルートで一括）

```sh
pnpm install
```

### 1. GAS バックエンド

```sh
pnpm login                  # clasp 認証（初回のみ）
# 既存スプレッドシートに紐付け済み（.clasp.json）。新規なら pnpm create
pnpm push                   # gas/ を GAS へ反映
```

スプレッドシートを開き直すと「dd-map」メニューが出る。

1. **初期セットアップ（シート作成）** を実行 → 入力/承認用/公開マスタ/ログ シート作成
2. **シークレット設定** を実行 → 順に入力:
   - `PLACES_API_KEY` / `GITHUB_TOKEN` / `GITHUB_OWNER` / `GITHUB_REPO` / `GITHUB_BRANCH` / `GITHUB_PATH`
   - `USER_PASSWORD`（一般ユーザー用パスワード）
   - `ADMIN_PASSWORD`（管理者用パスワード）
   - `AUTH_SECRET` はトークン署名用。未設定なら自動生成される（入力不要）。

### 2. Web App としてデプロイ

```sh
pnpm deploy                 # clasp deploy（または GASエディタ→デプロイ→ウェブアプリ）
```

- GASエディタの「デプロイ → デプロイを管理 / 新しいデプロイ → ウェブアプリ」で
  **アクセス: 全員（匿名含む）** / **実行: 自分** を確認。
- 発行された `https://script.google.com/macros/s/XXXX/exec` をコピー。

### 3. フロントをローカルで動かす

```sh
cp web/.env.example web/.env
# web/.env を編集し VITE_API_BASE に手順2の /exec URL を設定
pnpm dev                    # http://localhost:5173
```

- 一般パスワードでログイン → URL貼付 → ▶取得 → 内容確認・説明入力 → ▶送信 → スプレッドシート「承認用」に反映。
- 管理パスワードでログイン → 「承認・公開（管理）」タブ → チェック → 承認・公開マスタへ反映 → GitHubへ公開。

## GitHub Pages 公開（任意・後段）

このディレクトリはまだ git 管理外。公開する場合:

1. `git init` → GitHub リポジトリ作成・push
2. リポジトリ Settings → Pages → Source = **GitHub Actions**
3. Settings → Secrets and variables → Actions → **Variables** に
   `VITE_API_BASE` = GAS Web App の `/exec` URL を登録
4. `main` への push で `.github/workflows/deploy-pages.yml` が web/ をビルド・公開

## 開発コマンド

```sh
pnpm typecheck       # gas/ の型チェック
pnpm web:typecheck   # web/ の型チェック
pnpm push            # GAS へ反映
pnpm dev             # フロントをローカル起動
pnpm web:build       # フロントを本番ビルド（web/dist）
pnpm logs            # GAS 実行ログ
```

## 注意点

- GAS Web App は任意の CORS ヘッダを付けられないため、フロントは `text/plain` で
  POST する（単純リクエスト＝プリフライト不要）。`web/src/api.ts` 参照。
- 共有パスワード方式のため投稿者の厳密な追跡は不可。投稿者名は `submitted_by` の入力値として保持。
- `AUTH_SECRET` を変更すると既存の発行済みトークンは全て無効化される（再ログインが必要）。
- スプレッドシートのメニュー操作（従来フロー）も引き続き利用可能。
```
