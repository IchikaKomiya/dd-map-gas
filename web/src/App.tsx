import { useState } from "react";
import { useAuth } from "./auth";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Admin } from "./pages/Admin";

type Tab = "register" | "approval" | "publish";

export function App() {
  const { session, logout } = useAuth();
  const [tab, setTab] = useState<Tab>("register");

  if (!session) {
    return <Login />;
  }

  const isAdmin = session.role === "admin";

  return (
    <>
      <header className="app-header">
        <h1>dd-map スポット登録</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className={`role-badge ${isAdmin ? "admin" : ""}`}>
            {isAdmin ? "管理者" : "一般ユーザー"}
          </span>
          <button className="btn ghost" onClick={logout}>
            ログアウト
          </button>
        </div>
      </header>

      {isAdmin && (
        <nav className="tabs">
          <button
            className={tab === "register" ? "active" : ""}
            onClick={() => setTab("register")}
          >
            スポット登録
          </button>
          <button className={tab === "approval" ? "active" : ""} onClick={() => setTab("approval")}>
            承認待ち
          </button>
          <button className={tab === "publish" ? "active" : ""} onClick={() => setTab("publish")}>
            登録済み
          </button>
        </nav>
      )}

      <main className="container">
        {isAdmin && tab === "approval" ? (
          <Admin view="approval" />
        ) : isAdmin && tab === "publish" ? (
          <Admin view="publish" />
        ) : (
          <Register />
        )}
      </main>
    </>
  );
}
