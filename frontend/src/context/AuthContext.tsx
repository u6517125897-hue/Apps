import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { Platform } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { api, clearToken, getToken, setToken } from "../api/client";

WebBrowser.maybeCompleteAuthSession();

export type User = {
  user_id: string;
  email: string;
  name: string;
  picture?: string | null;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => {},
  signOut: async () => {},
});

const processed = new Set<string>();

async function exchange(sessionId: string): Promise<User | null> {
  if (processed.has(sessionId)) return null;
  processed.add(sessionId);
  const data = await api<{ session_token: string; user: User }>("/auth/session", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId }),
  });
  await setToken(data.session_token);
  return data.user;
}

function extractSessionId(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/[?#&]session_id=([^&#]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkExisting = useCallback(async () => {
    const t = await getToken();
    if (!t) {
      setLoading(false);
      return;
    }
    try {
      const u = await api<User>("/auth/me");
      setUser(u);
    } catch {
      await clearToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let captured: string | null = null;
    const sub = Linking.addEventListener("url", (e) => {
      const sid = extractSessionId(e.url);
      if (sid) captured = sid;
    });

    (async () => {
      // Web: check current URL
      if (Platform.OS === "web" && typeof window !== "undefined") {
        const sid = extractSessionId(window.location.hash) || extractSessionId(window.location.search);
        if (sid) {
          try {
            const u = await exchange(sid);
            if (u) setUser(u);
            // Clean URL
            try {
              const url = new URL(window.location.href);
              url.hash = "";
              url.searchParams.delete("session_id");
              window.history.replaceState(window.history.state, "", url.toString());
            } catch {}
            setLoading(false);
            return;
          } catch (e) {
            console.warn("session exchange failed", e);
          }
        }
      }
      // Mobile: cold-start URL
      if (Platform.OS !== "web") {
        const initial = await Linking.getInitialURL();
        const sid = extractSessionId(initial) || (captured ? extractSessionId(captured) : null);
        if (sid) {
          try {
            const u = await exchange(sid);
            if (u) {
              setUser(u);
              setLoading(false);
              return;
            }
          } catch (e) {
            console.warn("session exchange failed", e);
          }
        }
      }
      await checkExisting();
    })();

    return () => sub.remove();
  }, [checkExisting]);

  const signIn = useCallback(async () => {
    const redirectUrl =
      Platform.OS === "web" && typeof window !== "undefined"
        ? window.location.origin + "/"
        : Linking.createURL("");
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;

    if (Platform.OS === "web" && typeof window !== "undefined") {
      window.location.href = authUrl;
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUrl);
    let sid: string | null = null;
    if (result.type === "success" && (result as any).url) {
      sid = extractSessionId((result as any).url);
    }
    if (!sid) {
      const initial = await Linking.getInitialURL();
      sid = extractSessionId(initial);
    }
    if (sid) {
      try {
        const u = await exchange(sid);
        if (u) setUser(u);
      } catch (e) {
        console.warn("exchange failed", e);
      }
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {}
    await clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut }}>{children}</AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
