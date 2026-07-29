// Exit-code smoke contract for check-sentry-wiring.mjs.
//
// Documented contract: 0 when every checked project passes, 1 on any finding or
// an unreadable path, 2 on a bad invocation.

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkWiring = validator(SCRIPTS.checkSentryWiring);

/** A Metro config applying the SDK's bundler wrapper. */
const WRAPPED_METRO = `const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

module.exports = config;
`;

/** A Metro config built from the platform default instead. */
const UNWRAPPED_METRO = `const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
`;

/** An instrumentation module exporting the server error hook. */
const INSTRUMENTATION_WITH_HOOK = `import { captureRequestError } from "@sentry/nextjs";

export async function register() {}

export const onRequestError = captureRequestError;
`;

/** An instrumentation module missing the server error hook. */
const INSTRUMENTATION_WITHOUT_HOOK = `export async function register() {}
`;

/**
 * Build a project root with a package.json and any extra files.
 * @param {Record<string, unknown>} dependencies
 * @param {Record<string, string>} [files]
 */
async function project(dependencies, files = {}) {
  const root = await tempDir();
  await writeFileIn(
    root,
    "package.json",
    JSON.stringify({ name: "fixture", dependencies }, null, 2),
  );
  for (const [relative, content] of Object.entries(files)) {
    await writeFileIn(root, relative, content);
  }
  return root;
}

describe("check-sentry-wiring.mjs", () => {
  it("prints usage and exits 0 for --help", () => {
    expect(checkWiring("--help")).toPassCleanly();
  });

  it("exits 2 when no project root is given", () => {
    expect(checkWiring()).toExitWith(2);
  });

  it("exits 1 when the project root has no readable package.json", async () => {
    const root = await tempDir();

    expect(checkWiring(root)).toExitWith(1);
  });

  it("passes a project that declares no Sentry dependency", async () => {
    const root = await project({ react: "19.0.0" });

    expect(checkWiring(root)).toPassCleanly();
  });

  describe("secret checks", () => {
    it("reports an auth token behind a public environment prefix", async () => {
      const root = await project(
        {},
        { ".env": "EXPO_PUBLIC_SENTRY_AUTH_TOKEN=sntrys_abcdefghijklmnopqrst\n" },
      );

      expect(checkWiring(root)).toReportFailure(/public environment prefix/);
    });

    it("reports a public-prefixed token in source as well as env files", async () => {
      const root = await project(
        {},
        { "src/config.ts": 'const token = process.env.NEXT_PUBLIC_SENTRY_AUTH_TOKEN ?? "";\n' },
      );

      expect(checkWiring(root)).toReportFailure(/public environment prefix/);
    });

    it("reports a committed literal auth token", async () => {
      const root = await project(
        {},
        { "sentry.properties": "auth.token=sntryu_0123456789abcdefghij\n" },
      );

      expect(checkWiring(root)).toReportFailure(/literal Sentry auth token/);
    });

    it("ignores a commented-out placeholder in an env example", async () => {
      const root = await project(
        {},
        { ".env.example": "# EXPO_PUBLIC_SENTRY_AUTH_TOKEN=\n# SENTRY_AUTH_TOKEN=\n" },
      );

      expect(checkWiring(root)).toPassCleanly();
    });

    it("ignores a correctly named build-time token", async () => {
      const root = await project(
        {},
        { ".env.local": "SENTRY_AUTH_TOKEN=placeholder\n" },
      );

      expect(checkWiring(root)).toPassCleanly();
    });

    it("scans native project directories, where a properties file leaks", async () => {
      const root = await project(
        {},
        { "ios/sentry.properties": "auth.token=sntrys_0123456789abcdefghij\n" },
      );

      expect(checkWiring(root)).toReportFailure(/literal Sentry auth token/);
    });

    it("does not scan native build output", async () => {
      const root = await project(
        {},
        { "ios/Pods/x/sentry.properties": "auth.token=sntrys_0123456789abcdefghij\n" },
      );

      expect(checkWiring(root)).toPassCleanly();
    });

    it("does not scan node_modules", async () => {
      const root = await project(
        {},
        {
          "node_modules/leaky/index.js":
            "const t = process.env.NEXT_PUBLIC_SENTRY_AUTH_TOKEN = 1;\n",
        },
      );

      expect(checkWiring(root)).toPassCleanly();
    });
  });

  describe("React Native Metro wrapper", () => {
    it("passes a project whose Metro config applies the wrapper", async () => {
      const root = await project(
        { "@sentry/react-native": "~8.20.0" },
        { "metro.config.js": WRAPPED_METRO },
      );

      expect(checkWiring(root)).toPassCleanly();
    });

    it("reports a Metro config built from the platform default", async () => {
      const root = await project(
        { "@sentry/react-native": "~8.20.0" },
        { "metro.config.js": UNWRAPPED_METRO },
      );

      expect(checkWiring(root)).toReportFailure(/bundler wrapper/);
    });

    it("reports a React Native project with no Metro config at all", async () => {
      const root = await project({ "@sentry/react-native": "~8.20.0" });

      expect(checkWiring(root)).toReportFailure(/no Metro config/);
    });

    it("ignores the Metro config when the SDK is not a dependency", async () => {
      const root = await project({}, { "metro.config.js": UNWRAPPED_METRO });

      expect(checkWiring(root)).toPassCleanly();
    });
  });

  describe("Next.js server error hook", () => {
    it("passes a project exporting onRequestError", async () => {
      const root = await project(
        { "@sentry/nextjs": "^10.69.0" },
        { "instrumentation.ts": INSTRUMENTATION_WITH_HOOK },
      );

      expect(checkWiring(root)).toPassCleanly();
    });

    it("finds the instrumentation module under src/", async () => {
      const root = await project(
        { "@sentry/nextjs": "^10.69.0" },
        { "src/instrumentation.ts": INSTRUMENTATION_WITH_HOOK },
      );

      expect(checkWiring(root)).toPassCleanly();
    });

    it("reports an instrumentation module without the hook", async () => {
      const root = await project(
        { "@sentry/nextjs": "^10.69.0" },
        { "instrumentation.ts": INSTRUMENTATION_WITHOUT_HOOK },
      );

      expect(checkWiring(root)).toReportFailure(/no onRequestError/);
    });

    it("reports a Next.js project with no instrumentation module", async () => {
      const root = await project({ "@sentry/nextjs": "^10.69.0" });

      expect(checkWiring(root)).toReportFailure(/no instrumentation module/);
    });

    it("ignores a missing hook when the SDK is not a dependency", async () => {
      const root = await project(
        {},
        { "instrumentation.ts": INSTRUMENTATION_WITHOUT_HOOK },
      );

      expect(checkWiring(root)).toPassCleanly();
    });
  });

  it("checks every project root given", async () => {
    const clean = await project({ react: "19.0.0" });
    const broken = await project({ "@sentry/react-native": "~8.20.0" });

    expect(checkWiring(clean, broken)).toReportFailure(/no Metro config/);
  });
});
