// PropertiesService のラッパー。直書きを避け、欠落時は明示的にエラー。

function getProp(key: string): string {
  const v = PropertiesService.getScriptProperties().getProperty(key);
  if (!v) throw new Error(`Script property "${key}" is not set. Run setupSecrets() first.`);
  return v;
}

function getOptionalProp(key: string, fallback: string): string {
  return PropertiesService.getScriptProperties().getProperty(key) ?? fallback;
}

// 初回セットアップ用。GASエディタから一度だけ呼ぶ想定。
// 値は実行前にスクリプト内に書き換えてから実行 → 実行後にコードから値を消すこと。
function setupSecrets(): void {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const ask = (label: string, current: string) => {
    const res = ui.prompt(
      `スクリプトプロパティ: ${label}`,
      `現在値: ${current || "(未設定)"}\n新しい値を入力（空のままOKで変更なし）`,
      ui.ButtonSet.OK_CANCEL,
    );
    if (res.getSelectedButton() !== ui.Button.OK) return;
    const v = res.getResponseText();
    if (v) props.setProperty(label, v);
  };
  ask(PROP_KEYS.PLACES_API_KEY, props.getProperty(PROP_KEYS.PLACES_API_KEY) ?? "");
  ask(PROP_KEYS.GITHUB_TOKEN, props.getProperty(PROP_KEYS.GITHUB_TOKEN) ?? "");
  ask(PROP_KEYS.GITHUB_OWNER, props.getProperty(PROP_KEYS.GITHUB_OWNER) ?? "");
  ask(PROP_KEYS.GITHUB_REPO, props.getProperty(PROP_KEYS.GITHUB_REPO) ?? "");
  ask(PROP_KEYS.GITHUB_BRANCH, props.getProperty(PROP_KEYS.GITHUB_BRANCH) ?? "main");
  ask(PROP_KEYS.GITHUB_PATH, props.getProperty(PROP_KEYS.GITHUB_PATH) ?? "data.csv");
  // Web App 認証
  ask(PROP_KEYS.USER_PASSWORD, props.getProperty(PROP_KEYS.USER_PASSWORD) ?? "");
  ask(PROP_KEYS.ADMIN_PASSWORD, props.getProperty(PROP_KEYS.ADMIN_PASSWORD) ?? "");
  ensureAuthSecret();
  ui.alert("シークレットの更新が完了しました。");
}

// AUTH_SECRET が未設定なら自動生成（トークン署名用）。手動入力は不要。
function ensureAuthSecret(): string {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty(PROP_KEYS.AUTH_SECRET);
  if (!secret) {
    secret = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty(PROP_KEYS.AUTH_SECRET, secret);
    logEvent("INFO", "ensureAuthSecret", "AUTH_SECRET を自動生成しました。");
  }
  return secret;
}
