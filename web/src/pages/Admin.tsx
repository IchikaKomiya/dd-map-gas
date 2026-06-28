import { useCallback, useEffect, useState } from "react";
import { useApiCall } from "../auth";
import { ADMIN_LIST_COLUMNS, ADMIN_PUBLISH_COLUMNS, type SpotRecord } from "../fields";

interface ListResult {
  rows: SpotRecord[];
}
interface ApproveResult {
  upserted: number;
  removed: number;
}
interface PushResult {
  status: number;
  bytes: number;
}

type View = "approval" | "publish";

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return s.length > 60 ? s.slice(0, 57) + "…" : s;
}

export function Admin({ view }: { view: View }) {
  const api = useApiCall();
  const [rows, setRows] = useState<SpotRecord[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      const action = view === "approval" ? "listApproval" : "listPublish";
      const res = await api<ListResult>(action);
      setRows(res.rows);
      setSelected({});
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [api, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const isApproval = view === "approval";
  const columns = isApproval ? ADMIN_LIST_COLUMNS : ADMIN_PUBLISH_COLUMNS;
  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  function toggle(id: string) {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  }
  function toggleAll() {
    if (selectedIds.length === rows.length) {
      setSelected({});
    } else {
      const all: Record<string, boolean> = {};
      for (const r of rows) all[String(r.id)] = true;
      setSelected(all);
    }
  }

  async function onApprove() {
    if (selectedIds.length === 0) return;
    setError("");
    setNotice("");
    setBusy("approve");
    try {
      const res = await api<ApproveResult>("approve", { ids: selectedIds });
      setNotice(`${res.upserted}件を公開マスタへ反映しました。「登録済み」タブからGitHubへ公開できます。`);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function onPush() {
    setError("");
    setNotice("");
    setBusy("push");
    try {
      const res = await api<PushResult>("pushGithub");
      setNotice(`GitHubへ data.csv を公開しました（${res.bytes} bytes, HTTP ${res.status}）。`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ margin: 0 }}>
          {isApproval ? "承認待ち一覧" : "登録済み一覧"}
          {!loading && <span className="muted" style={{ fontSize: 13, marginLeft: 8 }}>{rows.length}件</span>}
        </h2>
        <button className="btn ghost" onClick={() => void load()} disabled={loading}>
          {loading ? <span className="spinner" /> : "再読込"}
        </button>
      </div>

      {error && <div className="alert error" style={{ marginTop: 16 }}>{error}</div>}
      {notice && <div className="alert success" style={{ marginTop: 16 }}>{notice}</div>}

      {loading ? (
        <div className="empty">読み込み中…</div>
      ) : rows.length === 0 ? (
        <div className="empty">
          {isApproval ? "承認待ちのスポットはありません。" : "登録済みのスポットはありません。"}
        </div>
      ) : (
        <div className="table-scroll" style={{ marginTop: 16 }}>
          <table className="data">
            <thead>
              <tr>
                {isApproval && (
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.length === rows.length && rows.length > 0}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                {columns.map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const id = String(r.id);
                return (
                  <tr key={id}>
                    {isApproval && (
                      <td>
                        <input
                          type="checkbox"
                          checked={!!selected[id]}
                          onChange={() => toggle(id)}
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td key={c} title={String(r[c] ?? "")}>
                        {cell(r[c])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {isApproval ? (
        <>
          <div className="btn-row">
            <button
              className="btn green"
              onClick={onApprove}
              disabled={busy !== "" || selectedIds.length === 0}
            >
              {busy === "approve" ? <span className="spinner" /> : `▶ 選択した${selectedIds.length}件を承認・公開マスタへ反映`}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            手順: 承認するスポットにチェック →「承認・公開マスタへ反映」。
            反映済みの行は承認待ち一覧から削除されます。GitHubへの公開は「登録済み」タブから行います。
          </p>
        </>
      ) : (
        <>
          <div className="btn-row">
            <button className="btn" onClick={onPush} disabled={busy !== ""}>
              {busy === "push" ? <span className="spinner" /> : "▶ GitHubへ公開（data.csv push）"}
            </button>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 12 }}>
            公開マスタに登録済み（承認済み）のスポット一覧です。閲覧専用。GitHubの data.csv はこの内容を公開します。
          </p>
        </>
      )}
    </div>
  );
}
