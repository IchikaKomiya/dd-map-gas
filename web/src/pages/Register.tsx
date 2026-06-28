import { useState } from "react";
import { useApiCall } from "../auth";
import {
  AUTO_FIELDS,
  MANUAL_FIELDS,
  COMPARE_FIELDS,
  REGISTER_PRIMARY_FIELDS,
  REGISTER_SECONDARY_FIELDS,
  type FieldDef,
  type SpotRecord,
} from "../fields";

interface ResolveResult {
  record: SpotRecord;
  duplicate: SpotRecord | null;
}
interface SubmitResult {
  mode: "insert" | "update";
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function Register() {
  const api = useApiCall();
  const [url, setUrl] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [duplicate, setDuplicate] = useState<SpotRecord | null>(null);
  const [fetched, setFetched] = useState(false);

  const [fetching, setFetching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showSecondary, setShowSecondary] = useState(false);

  const setField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  async function onFetch() {
    if (!url.trim()) return;
    setError("");
    setNotice("");
    setFetching(true);
    try {
      const res = await api<ResolveResult>("resolvePlace", { url: url.trim() });
      const next: Record<string, string> = { url_maps: url.trim() };
      for (const f of [...AUTO_FIELDS, ...MANUAL_FIELDS]) {
        next[f.key] = toStr(res.record[f.key]);
      }
      setForm(next);
      setDuplicate(res.duplicate);
      setFetched(true);
      setNotice(
        res.duplicate
          ? "⚠ 既存スポットと重複の可能性があります。右側の既存値を確認してください。"
          : "取得しました。説明・投稿者名を入力して送信してください。",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFetching(false);
    }
  }

  async function onSubmit() {
    setError("");
    setNotice("");
    // 必須チェック
    for (const f of MANUAL_FIELDS) {
      if (f.required && !toStr(form[f.key]).trim()) {
        setError(`${f.label}は必須です。`);
        return;
      }
    }
    setSubmitting(true);
    try {
      const record: SpotRecord = { ...form };
      const res = await api<SubmitResult>("submit", { record });
      setNotice(
        res.mode === "update"
          ? "既存の承認待ちエントリを更新しました。"
          : "承認待ちリストに登録しました。管理者の承認をお待ちください。",
      );
      onClear();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function onClear() {
    setUrl("");
    setForm({});
    setDuplicate(null);
    setFetched(false);
  }

  return (
    <>
      <div className="card">
        <h2>① GoogleマップのURLから取得</h2>
        <div className="field">
          <label htmlFor="url">
            GoogleマップURL<span className="req">*</span>
          </label>
          <input
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://maps.app.goo.gl/... または共有リンク"
          />
        </div>
        <div className="btn-row">
          <button className="btn" onClick={onFetch} disabled={fetching || !url.trim()}>
            {fetching ? <span className="spinner" /> : "▶ 取得"}
          </button>
          {fetched && (
            <button className="btn ghost" onClick={onClear} disabled={submitting}>
              クリア
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className={`alert ${duplicate ? "warn" : "success"}`}>{notice}</div>}

      {fetched && (
        <div className="card">
          <h2>② 内容を確認・入力して送信</h2>

          {duplicate ? (
            <div className="alert warn" style={{ marginBottom: 12 }}>
              既存スポットと一致の可能性があります。<b>左＝既存（変更前）</b> /{" "}
              <b>右＝今回の登録内容</b>。変更がある項目は黄色でハイライトされます。
            </div>
          ) : (
            <div className="alert success" style={{ marginBottom: 12 }}>
              新規スポット（既存データなし）。右側の内容で新規登録されます。
            </div>
          )}

          <div className="diff-table">
            <div className="diff-head">
              <div className="diff-col-label">項目</div>
              <div className="diff-col-old">既存（変更前）</div>
              <div className="diff-col-new">変更後（登録内容）</div>
            </div>

            <div className="diff-section">基本情報（確認・編集）</div>
            {REGISTER_PRIMARY_FIELDS.map((f) => (
              <DiffRow
                key={f.key}
                def={f}
                value={form[f.key] ?? ""}
                onChange={(v) => setField(f.key, v)}
                compare={f.key === "submitted_by" ? null : duplicate}
              />
            ))}

            <button
              type="button"
              className="diff-section toggle"
              aria-expanded={showSecondary}
              onClick={() => setShowSecondary((v) => !v)}
            >
              <span className="chevron">{showSecondary ? "▼" : "▶"}</span>
              位置・評価など（基本的に変更不要・{REGISTER_SECONDARY_FIELDS.length}項目）
            </button>
            {showSecondary &&
              REGISTER_SECONDARY_FIELDS.map((f) => (
                <DiffRow
                  key={f.key}
                  def={f}
                  value={form[f.key] ?? ""}
                  onChange={(v) => setField(f.key, v)}
                  compare={duplicate}
                />
              ))}
          </div>

          <div className="btn-row">
            <button className="btn green" onClick={onSubmit} disabled={submitting}>
              {submitting ? <span className="spinner" /> : "▶ 承認待ちリストへ送信"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function DiffRow({
  def,
  value,
  onChange,
  compare,
}: {
  def: FieldDef;
  value: string;
  onChange: (v: string) => void;
  compare: SpotRecord | null;
}) {
  const showCompare = !!compare && COMPARE_FIELDS.some((c) => c.key === def.key);
  const oldVal = showCompare ? toStr(compare![def.key]) : "";
  const isDiff = showCompare && oldVal.trim() !== value.trim();

  return (
    <div className={`diff-row ${isDiff ? "is-diff" : ""}`}>
      <div className="diff-label">
        <span>
          {def.label}
          {def.required && <span className="req">*</span>}
        </span>
        <span className="key">{def.key}</span>
        {def.note && <span className="note">{def.note}</span>}
      </div>

      <div className="diff-side old">
        {def.multiline ? (
          <textarea value={showCompare ? oldVal : ""} disabled placeholder={showCompare ? "" : "—（既存なし）"} />
        ) : (
          <input value={showCompare ? oldVal : ""} disabled placeholder={showCompare ? "" : "—（既存なし）"} />
        )}
      </div>

      <div className="diff-side new">
        {def.multiline ? (
          <textarea value={value} onChange={(e) => onChange(e.target.value)} />
        ) : (
          <input value={value} onChange={(e) => onChange(e.target.value)} />
        )}
      </div>
    </div>
  );
}
