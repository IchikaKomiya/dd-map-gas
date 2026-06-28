import { useState, type FormEvent } from "react";
import { useAuth } from "../auth";

export function Login() {
  const { login } = useAuth();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={onSubmit}>
        <div className="logo">dd-map</div>
        <div className="sub">スポット登録システム</div>

        {error && <div className="alert error">{error}</div>}

        <div className="field">
          <label htmlFor="pw">パスワード</label>
          <input
            id="pw"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            placeholder="一般ユーザー / 管理者 パスワード"
          />
        </div>

        <button className="btn" type="submit" disabled={loading || !password} style={{ width: "100%" }}>
          {loading ? <span className="spinner" /> : "ログイン"}
        </button>
      </form>
    </div>
  );
}
