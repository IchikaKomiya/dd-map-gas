// Google Places API（New）連携
// 多様なGoogleマップURL形式から place_id を引き当てる or 名前+座標で検索する。

interface UrlParts {
  placeId?: string; // Places API New の place_id (ChIJ... 形式)
  name?: string;
  lat?: number;
  lng?: number;
  ftid?: string; // 16進形式の Feature ID（Places API New では直接使えない）
  cid?: string; // Customer ID
}

// Places API New の place_id らしいか判定
// 例: "ChIJgUbEo8cfqokR5lP9_Wh_DaM" / 20文字以上のBase64-URLセーフ文字列
function looksLikePlaceId(s: string): boolean {
  return /^[A-Za-z0-9_-]{20,}$/.test(s) && !s.includes(":");
}

// 多様なGoogleマップURL形式に対応したパーサ
function parseMapsUrl(url: string): UrlParts {
  const r: UrlParts = {};

  // 1) place_id クエリパラメータ (例: ?place_id=ChIJ...)
  const m = url.match(/[?&]place_id=([^&#]+)/);
  if (m) {
    const id = decodeUriSafe(m[1]);
    if (looksLikePlaceId(id)) r.placeId = id;
  }

  // 2) query_place_id (例: /maps/search/?query=...&query_place_id=ChIJ...)
  const m2 = url.match(/[?&]query_place_id=([^&#]+)/);
  if (m2 && !r.placeId) {
    const id = decodeUriSafe(m2[1]);
    if (looksLikePlaceId(id)) r.placeId = id;
  }

  // 3) /maps/place/<name>/ から名前抽出
  const m3 = url.match(/\/maps\/place\/([^/@?#]+)/);
  if (m3) {
    const decoded = decodeUriSafe(m3[1]).replace(/\+/g, " ").trim();
    if (decoded) r.name = decoded;
  }

  // 4) /maps/search/?query=... または ?api=1&query=...
  const m4 = url.match(/[?&]query=([^&#]+)/);
  if (m4 && !r.name) {
    const decoded = decodeUriSafe(m4[1]).replace(/\+/g, " ").trim();
    if (decoded) r.name = decoded;
  }

  // 5) ?q=... （旧形式 maps?q= や maps?q=lat,lng）
  const m5 = url.match(/[?&]q=([^&#]+)/);
  if (m5) {
    const decoded = decodeUriSafe(m5[1]).replace(/\+/g, " ").trim();
    // 「lat,lng」の形式か判定
    const coord = decoded.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coord) {
      r.lat = parseFloat(coord[1]);
      r.lng = parseFloat(coord[2]);
    } else if (!r.name && decoded) {
      r.name = decoded;
    }
  }

  // 6) !3d<lat>!4d<lng> （新形式URLの内部データ、最も信頼性が高い）
  const m6 = url.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  if (m6) {
    r.lat = parseFloat(m6[1]);
    r.lng = parseFloat(m6[2]);
  }

  // 7) @lat,lng,zoom （地図の中心座標。スポット中心とは限らないがフォールバック）
  if (r.lat === undefined || r.lng === undefined) {
    const m7 = url.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (m7) {
      r.lat = parseFloat(m7[1]);
      r.lng = parseFloat(m7[2]);
    }
  }

  // 8) !1s<hex:hex> Feature ID（直接APIには使えないが情報として保持）
  const m8 = url.match(/!1s(0x[a-f0-9]+:0x[a-f0-9]+)/);
  if (m8) r.ftid = m8[1];

  // 9) ?cid=<digits>
  const m9 = url.match(/[?&]cid=(\d+)/);
  if (m9) r.cid = m9[1];

  return r;
}

function decodeUriSafe(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

// 短縮URL展開（maps.app.goo.gl, goo.gl/maps, g.co/kgs/ 等）
// 場合により2段リダイレクトされるため最大3回まで追従
function expandShortUrl(url: string): string {
  const shortPatterns = /maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs/;
  let current = url;
  for (let i = 0; i < 3; i++) {
    if (!shortPatterns.test(current)) break;
    const res = UrlFetchApp.fetch(current, {
      followRedirects: false,
      muteHttpExceptions: true,
    });
    const code = res.getResponseCode();
    if (code < 300 || code >= 400) break;
    const headers = res.getAllHeaders() as Record<string, string>;
    const loc = headers["Location"] || headers["location"];
    if (!loc) break;
    current = loc;
  }
  return current;
}

interface PlaceDetails {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  primaryTypeDisplayName?: { text: string };
  editorialSummary?: { text: string; languageCode?: string };
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  types?: string[];
  plusCode?: { globalCode?: string; compoundCode?: string };
}

const PLACES_FIELDS = [
  "id",
  "displayName",
  "formattedAddress",
  "location",
  "internationalPhoneNumber",
  "websiteUri",
  "rating",
  "userRatingCount",
  "primaryTypeDisplayName",
  "editorialSummary",
  "regularOpeningHours",
  "types",
  "plusCode",
] as const;

function fetchPlaceDetailsById(placeId: string): PlaceDetails {
  const apiKey = getProp(PROP_KEYS.PLACES_API_KEY);
  const url = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=ja`;
  const res = UrlFetchApp.fetch(url, {
    method: "get",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": PLACES_FIELDS.join(","),
    },
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code !== 200) {
    throw new Error(`Places API GET ${code}: ${body}`);
  }
  return JSON.parse(body) as PlaceDetails;
}

function searchPlaceByText(
  textQuery: string,
  bias?: { lat: number; lng: number; radius?: number },
): PlaceDetails {
  const apiKey = getProp(PROP_KEYS.PLACES_API_KEY);
  const payload: Record<string, unknown> = {
    textQuery,
    languageCode: "ja",
    maxResultCount: 1,
  };
  if (bias) {
    payload.locationBias = {
      circle: {
        center: { latitude: bias.lat, longitude: bias.lng },
        radius: bias.radius ?? 1000,
      },
    };
  }
  const res = UrlFetchApp.fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "post",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": PLACES_FIELDS.map((f) => `places.${f}`).join(","),
    },
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code !== 200) {
    throw new Error(`Places searchText ${code}: ${body}`);
  }
  const parsed = JSON.parse(body) as { places?: PlaceDetails[] };
  if (!parsed.places || parsed.places.length === 0) {
    throw new Error(`「${textQuery}」が見つかりませんでした`);
  }
  return parsed.places[0];
}

function searchPlaceNearby(lat: number, lng: number): PlaceDetails {
  const apiKey = getProp(PROP_KEYS.PLACES_API_KEY);
  const payload = {
    locationRestriction: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 100,
      },
    },
    maxResultCount: 1,
    languageCode: "ja",
    rankPreference: "DISTANCE",
  };
  const res = UrlFetchApp.fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "post",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": PLACES_FIELDS.map((f) => `places.${f}`).join(","),
    },
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode();
  const body = res.getContentText();
  if (code !== 200) {
    throw new Error(`Places searchNearby ${code}: ${body}`);
  }
  const parsed = JSON.parse(body) as { places?: PlaceDetails[] };
  if (!parsed.places || parsed.places.length === 0) {
    throw new Error(`座標 (${lat}, ${lng}) の周辺にスポットが見つかりませんでした`);
  }
  return parsed.places[0];
}

// 多段フォールバックでスポット詳細を取得
function resolvePlace(url: string): PlaceDetails {
  const expanded = expandShortUrl(url);
  const parts = parseMapsUrl(expanded);

  // 戦略1: 直接 place_id があれば GET
  if (parts.placeId) {
    try {
      return fetchPlaceDetailsById(parts.placeId);
    } catch (e) {
      logEvent("WARN", "resolvePlace", `place_id failed (${parts.placeId}): ${(e as Error).message}`);
    }
  }

  // 戦略2: 名前 + 座標 → searchText（最も実用的）
  if (parts.name && parts.lat !== undefined && parts.lng !== undefined) {
    return searchPlaceByText(parts.name, { lat: parts.lat, lng: parts.lng, radius: 500 });
  }

  // 戦略3: 名前のみ → searchText
  if (parts.name) {
    return searchPlaceByText(parts.name);
  }

  // 戦略4: 座標のみ → searchNearby（近接1件）
  if (parts.lat !== undefined && parts.lng !== undefined) {
    return searchPlaceNearby(parts.lat, parts.lng);
  }

  throw new Error(
    `URLからスポット情報を抽出できませんでした。\n` +
      `Googleマップでスポットを開いて『共有』→『リンクをコピー』したURLを使ってください。\n\n` +
      `URL: ${url}`,
  );
}

// PlaceDetails → 自動取得フィールドのレコード（メニュー/Web API 共通）
// description は editorialSummary を「デフォルト候補」として返す（呼び出し側で扱いを分ける）
function placeDetailsToRecord(d: PlaceDetails): Record<string, unknown> {
  return {
    id: d.id,
    spot_name: d.displayName?.text ?? "",
    category: d.primaryTypeDisplayName?.text ?? "",
    types: d.types?.join(", ") ?? "",
    address: d.formattedAddress ?? "",
    tel: d.internationalPhoneNumber ?? "",
    opening_hours: d.regularOpeningHours?.weekdayDescriptions?.join("\n") ?? "",
    url_official: d.websiteUri ?? "",
    lat: d.location?.latitude ?? "",
    lng: d.location?.longitude ?? "",
    plus_code: d.plusCode?.globalCode ?? "",
    rating: d.rating ?? "",
    reviews_count: d.userRatingCount ?? "",
    description: d.editorialSummary?.text ?? "",
  };
}

// URL → スポット詳細レコード（Web API 用ヘッドレス版）
function resolvePlaceToRecord(url: string): Record<string, unknown> {
  const d = resolvePlace(url);
  logEvent("INFO", "resolvePlaceToRecord", `id=${d.id} name=${d.displayName?.text ?? ""}`);
  return placeDetailsToRecord(d);
}

// メニュー/ボタン「① URLから取得」
function fetchToForm(): void {
  const ss = SpreadsheetApp.getActive();
  const sheet = getSheetOrThrow(SHEET_INPUT);
  const url = String(sheet.getRange(FORM_ROW.url_maps, FORM_COL.VALUE).getValue() || "").trim();
  if (!url) {
    SpreadsheetApp.getUi().alert("URLを入力してください（B3セル）。");
    return;
  }
  ss.toast("URLを解析中…", "dd-map");
  const rec = resolvePlaceToRecord(url);

  for (const f of AUTO_FIELDS) {
    writeFormField(f, rec[f] ?? "");
  }

  // description が空ならGoogle編集者要約をデフォルト代入（ユーザー入力があれば尊重）
  const currentDesc = String(sheet.getRange(FORM_ROW.description, FORM_COL.VALUE).getValue() || "").trim();
  if (!currentDesc && rec.description) {
    writeFormField("description", rec.description as string);
  }

  showDuplicate();

  ss.toast("取得完了。内容を確認して『▶ 承認用へ追加』をチェック。", "dd-map", 5);
}
