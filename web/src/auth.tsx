import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { callApi } from "./api";

export type Role = "user" | "admin";

interface Session {
  token: string;
  role: Role;
}

interface AuthContextValue {
  session: Session | null;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

const STORAGE_KEY = "dd-map-session";

const AuthContext = createContext<AuthContextValue | null>(null);

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    if (parsed && parsed.token && (parsed.role === "user" || parsed.role === "admin")) {
      return parsed;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(loadSession);

  const login = useCallback(async (password: string) => {
    const data = await callApi<Session>("login", { password });
    setSession(data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, []);

  const logout = useCallback(() => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, login, logout }),
    [session, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth は AuthProvider 内で使用してください。");
  return ctx;
}

// セッション期限切れ等のAPIエラーを検知してログアウトさせるヘルパー
export function useApiCall() {
  const { session, logout } = useAuth();
  return useCallback(
    async <T,>(action: string, payload: Record<string, unknown> = {}): Promise<T> => {
      try {
        return await callApi<T>(action, payload, session?.token ?? "");
      } catch (e) {
        const msg = (e as Error).message;
        if (msg.includes("有効期限") || msg.includes("トークン") || msg.includes("認証")) {
          logout();
        }
        throw e;
      }
    },
    [session, logout],
  );
}
