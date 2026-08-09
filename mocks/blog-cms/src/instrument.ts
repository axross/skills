// Imported first from main.tsx, before the application's own modules
// evaluate — see AGENTS.md's note on why this file does nothing else.
import * as Sentry from "@sentry/react";

const dsn = import.meta.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    sendDefaultPii: false,
    tracesSampleRate: import.meta.env.PROD ? 0.2 : 0,
  });
} else if (import.meta.env.DEV) {
  console.warn("VITE_SENTRY_DSN is not set; error reporting is disabled.");
}
