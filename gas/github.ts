// GitHub Contents API で data.csv を上書き
// PUT /repos/{owner}/{repo}/contents/{path}
// 既存ファイルがある場合は sha を渡す必要がある。

interface GhContentMeta {
  sha: string;
}

function ghBaseUrl(): string {
  const owner = getProp(PROP_KEYS.GITHUB_OWNER);
  const repo = getProp(PROP_KEYS.GITHUB_REPO);
  const path = getProp(PROP_KEYS.GITHUB_PATH);
  return `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
}

function ghHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${getProp(PROP_KEYS.GITHUB_TOKEN)}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function getCurrentSha(): string | null {
  const branch = getOptionalProp(PROP_KEYS.GITHUB_BRANCH, "main");
  const res = UrlFetchApp.fetch(`${ghBaseUrl()}?ref=${encodeURIComponent(branch)}`, {
    method: "get",
    headers: ghHeaders(),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code === 404) return null;
  if (code !== 200) {
    throw new Error(`GitHub GET ${code}: ${res.getContentText()}`);
  }
  return (JSON.parse(res.getContentText()) as GhContentMeta).sha;
}

// 公開マスタ → CSV を GitHub に push（メニュー/Web API 共通）。返り値: status/bytes
function pushToGitHubCore(): { status: number; bytes: number } {
  const csv = buildPublishCsv();
  if (!csv) {
    throw new Error("公開マスタが空です。先に承認・反映を実行してください。");
  }
  const branch = getOptionalProp(PROP_KEYS.GITHUB_BRANCH, "main");
  const sha = getCurrentSha();
  const payload: Record<string, string> = {
    message: `chore: update data.csv (${Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm")})`,
    content: Utilities.base64Encode(csv, Utilities.Charset.UTF_8),
    branch,
  };
  if (sha) payload.sha = sha;

  const res = UrlFetchApp.fetch(ghBaseUrl(), {
    method: "put",
    headers: ghHeaders(),
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  if (code !== 200 && code !== 201) {
    logEvent("ERROR", "pushToGitHubCore", `${code}: ${res.getContentText()}`);
    throw new Error(`GitHub PUT ${code}: ${res.getContentText()}`);
  }
  logEvent("INFO", "pushToGitHubCore", `status=${code} bytes=${csv.length}`);
  return { status: code, bytes: csv.length };
}

function pushToGitHub(): void {
  try {
    pushToGitHubCore();
  } catch (e) {
    SpreadsheetApp.getUi().alert((e as Error).message);
    return;
  }
  SpreadsheetApp.getUi().alert("GitHubへ data.csv を反映しました。");
}
