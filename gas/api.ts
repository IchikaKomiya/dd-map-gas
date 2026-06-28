// Web App JSON API（doGet / doPost）+ ロール別パスワード認証
//
// フロント（GitHub Pages / localhost）から呼ばれるエンドポイント。
// CORS プリフライト回避のため、フロントは Content-Type: text/plain で
// {action, token, payload} の JSON 文字列を POST する。
// 認証はステートレストークン: `role.expiry.HMACsig`（AUTH_SECRET で署名）。

interface ApiRequest {
  action: string;
  token: string;
  payload: Record<string, unknown>;
}

function doGet(e: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput {
  return handleApi(e);
}

function doPost(e: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  return handleApi(e);
}

function jsonOut(obj: unknown): GoogleAppsScript.Content.TextOutput {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function parseRequest(
  e: GoogleAppsScript.Events.DoGet | GoogleAppsScript.Events.DoPost,
): ApiRequest {
  let body: Record<string, unknown> = {};
  const post = (e as GoogleAppsScript.Events.DoPost).postData;
  if (post && post.contents) {
    try {
      body = JSON.parse(post.contents) as Record<string, unknown>;
    } catch (_err) {
      body = {};
    }
  }
  const params = (e && e.parameter) || {};
  const action = String(body.action ?? params.action ?? "");
  const token = String(body.token ?? params.token ?? "");
  const payload = (body.payload as Record<string, unknown>) ?? {};
  return { action, token, payload };
}

function handleApi(
  e: GoogleAppsScript.Events.DoGet | GoogleAppsScript.Events.DoPost,
): GoogleAppsScript.Content.TextOutput {
  let action = "";
  try {
    const req = parseRequest(e);
    action = req.action;
    if (!action) return jsonOut({ ok: false, error: "action が指定されていません。" });

    switch (action) {
      case "ping":
        return jsonOut({ ok: true, data: { pong: true } });

      case "login":
        return jsonOut({ ok: true, data: handleLogin(req.payload) });

      case "resolvePlace": {
        requireRole(req.token, "user");
        const rec = resolvePlaceToRecord(String(req.payload.url ?? "").trim());
        const dup = findExistingMatchFor(rec.id, rec.lat, rec.lng);
        return jsonOut({ ok: true, data: { record: rec, duplicate: dup } });
      }

      case "checkDuplicate": {
        requireRole(req.token, "user");
        const p = req.payload;
        const dup = findExistingMatchFor(p.id, p.lat, p.lng);
        return jsonOut({ ok: true, data: { duplicate: dup } });
      }

      case "submit": {
        requireRole(req.token, "user");
        const rec = sanitizeSubmission((req.payload.record as Record<string, unknown>) ?? {});
        const result = addRecordToApproval(rec);
        return jsonOut({ ok: true, data: result });
      }

      case "listApproval": {
        requireRole(req.token, "admin");
        return jsonOut({ ok: true, data: { rows: readTableRowsByName(SHEET_APPROVAL) } });
      }

      case "listPublish": {
        requireRole(req.token, "admin");
        return jsonOut({ ok: true, data: { rows: readTableRowsByName(SHEET_PUBLISH) } });
      }

      case "approve": {
        requireRole(req.token, "admin");
        const rawIds = req.payload.ids;
        const ids = Array.isArray(rawIds) ? rawIds.map((x) => String(x)) : [];
        const result = approveIdsAndPublish(ids);
        return jsonOut({ ok: true, data: result });
      }

      case "pushGithub": {
        requireRole(req.token, "admin");
        const result = pushToGitHubCore();
        return jsonOut({ ok: true, data: result });
      }

      default:
        return jsonOut({ ok: false, error: `未知の action: ${action}` });
    }
  } catch (err) {
    const msg = (err as Error).message;
    logEvent("ERROR", `api:${action}`, msg);
    return jsonOut({ ok: false, error: msg });
  }
}

// ---- 認証 ----

function handleLogin(payload: Record<string, unknown>): { token: string; role: Role } {
  const password = String(payload.password ?? "");
  const adminPw = getOptionalProp(PROP_KEYS.ADMIN_PASSWORD, "");
  const userPw = getOptionalProp(PROP_KEYS.USER_PASSWORD, "");
  let role: Role | null = null;
  if (adminPw && password === adminPw) role = "admin";
  else if (userPw && password === userPw) role = "user";
  if (!role) throw new Error("パスワードが正しくありません。");
  logEvent("INFO", "login", `role=${role}`);
  return { token: signToken(role), role };
}

function signToken(role: Role): string {
  const expiry = Date.now() + TOKEN_TTL_HOURS * 3600 * 1000;
  const body = `${role}.${expiry}`;
  return `${body}.${computeSig(body)}`;
}

function computeSig(body: string): string {
  const secret = ensureAuthSecret();
  const raw = Utilities.computeHmacSha256Signature(body, secret);
  return raw.map((b) => ("0" + (b & 0xff).toString(16)).slice(-2)).join("");
}

function verifyToken(token: string): Role {
  if (!token) throw new Error("認証が必要です。ログインしてください。");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("トークンが不正です。");
  const [role, expiryStr, sig] = parts;
  const body = `${role}.${expiryStr}`;
  if (computeSig(body) !== sig) throw new Error("トークン署名が不正です。");
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) {
    throw new Error("セッションの有効期限が切れました。再ログインしてください。");
  }
  if (role !== "user" && role !== "admin") throw new Error("トークンのロールが不正です。");
  return role;
}

function requireRole(token: string, required: Role): Role {
  const role = verifyToken(token);
  if (required === "admin" && role !== "admin") {
    throw new Error("この操作には管理者権限が必要です。");
  }
  return role;
}

// ---- ヘルパー ----

function readTableRowsByName(name: string): Array<Record<string, unknown>> {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) return [];
  return readTableRows(sheet);
}

// 許可フィールドのみ抽出（approved 等のクライアント偽装を防ぐ）
function sanitizeSubmission(input: Record<string, unknown>): Record<string, unknown> {
  const rec: Record<string, unknown> = {};
  for (const f of SUBMITTABLE_FIELDS) {
    if (input[f] !== undefined) rec[f] = input[f];
  }
  return rec;
}
