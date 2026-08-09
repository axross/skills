// Imported first from main.tsx, before the application's own modules
// evaluate, so an error thrown while one of them is initialising is still
// reported. That ordering is the only reason this file exists separately, and
// the reason it does nothing else: anything added here runs before the app.
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
