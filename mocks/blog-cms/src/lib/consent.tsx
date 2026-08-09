import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { initAnalytics } from "./analytics";

export type ConsentStatus = "unknown" | "granted" | "denied";

const STORAGE_KEY = "blog-cms:consent";

interface ConsentContextValue {
  readonly status: ConsentStatus;
  readonly grant: () => void;
  readonly deny: () => void;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

function readStoredConsent(): ConsentStatus {
  if (typeof window === "undefined") return "unknown";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "granted" || stored === "denied" ? stored : "unknown";
}

/**
 * Owns the one decision analytics waits on. `initAnalytics()` only ever runs
 * from the effect below, in response to `status` becoming "granted" — never
 * eagerly, and never from the banner itself, so there is exactly one place
 * that can start the SDK.
 */
export function ConsentProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [status, setStatus] = useState<ConsentStatus>(readStoredConsent);

  useEffect(() => {
    if (status === "granted") initAnalytics();
  }, [status]);

  const grant = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "granted");
    setStatus("granted");
  }, []);

  const deny = useCallback(() => {
    window.localStorage.setItem(STORAGE_KEY, "denied");
    setStatus("denied");
  }, []);

  return (
    <ConsentContext.Provider value={{ status, grant, deny }}>{children}</ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const context = useContext(ConsentContext);
  if (!context) throw new Error("useConsent must be used within a ConsentProvider.");
  return context;
}
