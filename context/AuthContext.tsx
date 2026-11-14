"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SIGNED_OUT, parseSession, type AuthSession } from "@/lib/auth-session";

interface AuthValue extends AuthSession {
  /** İlk yanıt geldi mi (false iken user henüz bilinmiyor). */
  loaded: boolean;
  refresh: () => void;
  clear: () => void;
}

const AuthContext = createContext<AuthValue>({ ...SIGNED_OUT, loaded: false, refresh: () => {}, clear: () => {} });

/** Oturum bilgisi (/api/auth/me): ilk yüklemede BİR kez, sonra yalnızca "ya-auth" olayında (giriş, çıkış, ad değişikliği) yenilenir. */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ session: AuthSession; loaded: boolean }>({ session: SIGNED_OUT, loaded: false });

  const refresh = useCallback(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setState({ session: parseSession(data), loaded: true }))
      .catch(() => {});
  }, []);
  const clear = useCallback(() => setState({ session: SIGNED_OUT, loaded: true }), []);

  useEffect(() => {
    refresh();
    window.addEventListener("ya-auth", refresh);
    return () => window.removeEventListener("ya-auth", refresh);
  }, [refresh]);

  const value = useMemo(() => ({ ...state.session, loaded: state.loaded, refresh, clear }), [state, refresh, clear]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
