// GAS Web App との通信クライアント。
// CORS プリフライト回避のため text/plain で {action, token, payload} を POST する。

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

const BASE = import.meta.env.VITE_API_BASE;

export class ApiError extends Error {}

export async function callApi<T>(
  action: string,
  payload: Record<string, unknown> = {},
  token = "",
): Promise<T> {
  if (!BASE) {
    throw new ApiError(
      "VITE_API_BASE が未設定です。web/.env に GAS Web App の /exec URL を設定してください。",
    );
  }
  let res: Response;
  try {
    res = await fetch(BASE, {
      method: "POST",
      // text/plain にすることで preflight を発生させない（GAS は CORS ヘッダを付けられないため）
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, token, payload }),
      redirect: "follow",
    });
  } catch (e) {
    throw new ApiError(`ネットワークエラー: ${(e as Error).message}`);
  }

  const text = await res.text();
  let json: ApiEnvelope<T>;
  try {
    json = JSON.parse(text) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(`サーバ応答の解析に失敗しました。\n${text.slice(0, 300)}`);
  }
  if (!json.ok) {
    throw new ApiError(json.error || "不明なエラーが発生しました。");
  }
  return json.data as T;
}
