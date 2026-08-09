import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The Sentry plugin only runs when a build-time auth token is present, the
// same way most CI pipelines gate it: a local build with no token still
// produces working output, it just doesn't upload anything. See
// docs/deploy-hooks.md for the pattern this mirrors on the API side.
const sentryPlugin = process.env.SENTRY_AUTH_TOKEN
  ? sentryVitePlugin({
      org: process.env.SENTRY_ORG ?? "blog-cms",
      project: process.env.SENTRY_PROJECT ?? "blog-cms-web",
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ["dist/**/*.map"],
      },
    })
  : undefined;

const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET ?? "http://localhost:8787";

export default defineConfig({
  plugins: [react(), sentryPlugin].filter(Boolean),
  build: {
    // Required for the Sentry plugin above to have anything to upload, and
    // for a production stack trace to resolve back to real source at all.
    sourcemap: true,
  },
  server: {
    proxy: {
      "/api": API_PROXY_TARGET,
    },
  },
  preview: {
    proxy: {
      "/api": API_PROXY_TARGET,
    },
  },
});
