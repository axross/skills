import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from "react";

import {
  getSession,
  signIn as requestSignIn,
  signOut as requestSignOut,
  type Session,
} from "./session";

type SessionContextValue = {
  session: Session | null;
  status: "loading" | "ready";
  signIn: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(
  undefined,
);

/**
 * Reads the persisted session once on mount, then exposes it — and the
 * sign-in/sign-out actions — to the whole app via `useSession`.
 */
export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<"loading" | "ready">("loading");

  useEffect(() => {
    let cancelled = false;

    getSession()
      .then((found) => {
        if (cancelled) return;
        setSession(found);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        // Nothing on this screen can retry a read this early, and the
        // corrupt-value case is already handled inside `getSession` itself —
        // so whatever is left is treated the same way: fall back to signed
        // out rather than leaving `status` stuck on "loading" forever.
        setSession(null);
        setStatus("ready");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async (email: string) => {
    const next = await requestSignIn(email);
    setSession(next);
  }, []);

  const signOut = useCallback(async () => {
    await requestSignOut();
    setSession(null);
  }, []);

  return (
    <SessionContext.Provider value={{ session, status, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return value;
}
