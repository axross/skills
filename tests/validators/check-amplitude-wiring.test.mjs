// Exit-code contract for check-amplitude-wiring.mjs.
//
// Documented contract: 0 when no violation is found, 1 on any violation or an
// unreadable path, 2 on a bad invocation.
//
// The negative cases carry as much weight as the positive ones here. Each of
// the three checks was narrowed during planning specifically to avoid firing on
// correct code, and two of those narrowings — a public prefix on an ordinary
// API key, and a devDependencies-only AsyncStorage declaration — are asserted
// below so a later broadening cannot pass silently.

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkWiring = validator(SCRIPTS.checkAmplitudeWiring);

/** A fake 32-character hex string, the shape of an Amplitude API key. */
const FAKE_KEY = "0123456789abcdef0123456789abcdef";

/** A wrapper module that reads its key from configuration — the correct shape. */
const CLEAN_SOURCE = `import * as amplitude from "@amplitude/analytics-browser";

export function initAnalytics() {
  const key = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;
  if (!key) return;
  amplitude.init(key);
}
`;

/** Build a project directory from a map of relative path to contents. */
async function project(files) {
  const root = await tempDir();
  for (const [path, content] of Object.entries(files)) {
    await writeFileIn(root, path, content);
  }
  return root;
}

describe("check-amplitude-wiring.mjs", () => {
  it("exits 0 and prints usage for --help", () => {
    const result = checkWiring("--help");

    expect(result).toPassCleanly();
    expect(result.output).toMatch(/Usage: check-amplitude-wiring\.mjs/);
  });

  it("exits 0 on a project with correct wiring", async () => {
    const root = await project({
      "src/analytics.ts": CLEAN_SOURCE,
      "package.json": JSON.stringify({
        dependencies: {
          "@amplitude/analytics-react-native": "^1.6.8",
          "@react-native-async-storage/async-storage": "^2.1.0",
        },
      }),
    });

    expect(checkWiring(root)).toPassCleanly();
  });

  describe("check 1 — API key literal", () => {
    it("reports a key literal in an Amplitude source file", async () => {
      const root = await project({
        "src/analytics.ts": `import * as amplitude from "@amplitude/analytics-browser";
amplitude.init(process.env.AMPLITUDE_KEY ?? "${FAKE_KEY}");
`,
      });

      expect(checkWiring(root)).toReportFailure(/API key literal/);
    });

    it("locates the literal by file and line", async () => {
      const root = await project({
        "src/analytics.ts": `// amplitude wrapper\n\nconst key = "${FAKE_KEY}";\n`,
      });

      expect(checkWiring(root)).toReportFailure(/src\/analytics\.ts:3/);
    });

    it("does not fire on a 32-character hex value outside an Amplitude file", async () => {
      const root = await project({
        "src/hash.ts": `export const CACHE_KEY = "${FAKE_KEY}";\n`,
      });

      expect(checkWiring(root)).toPassCleanly();
    });
  });

  describe("check 2 — secret-tier credential behind a public prefix", () => {
    it.each([
      {
        what: "a secret key in source",
        path: "src/config.ts",
        content: `export const secret = process.env.NEXT_PUBLIC_AMPLITUDE_SECRET_KEY;\n`,
        reported: /NEXT_PUBLIC_AMPLITUDE_SECRET_KEY/,
      },
      {
        what: "an Ampli token in an env file",
        path: ".env.local",
        content: "EXPO_PUBLIC_AMPLI_TOKEN=abc123\n",
        reported: /EXPO_PUBLIC_AMPLI_TOKEN/,
      },
    ])("reports $what", async ({ path, content, reported }) => {
      const root = await project({ [path]: content });

      expect(checkWiring(root)).toReportFailure(reported);
    });

    it("does not fire on a public prefix carrying an ordinary API key", async () => {
      const root = await project({
        ".env": "NEXT_PUBLIC_AMPLITUDE_API_KEY=abc123\n",
        "src/analytics.ts": CLEAN_SOURCE,
      });

      expect(checkWiring(root)).toPassCleanly();
    });
  });

  describe("check 3 — React Native SDK without AsyncStorage", () => {
    it("reports a manifest that omits AsyncStorage entirely", async () => {
      const root = await project({
        "package.json": JSON.stringify({
          dependencies: { "@amplitude/analytics-react-native": "^1.6.8" },
        }),
      });

      expect(checkWiring(root)).toReportFailure(/async-storage/);
    });

    it("does not fire on a devDependencies-only declaration", async () => {
      const root = await project({
        "package.json": JSON.stringify({
          dependencies: { "@amplitude/analytics-react-native": "^1.6.8" },
          devDependencies: {
            "@react-native-async-storage/async-storage": "^2.1.0",
          },
        }),
      });

      expect(checkWiring(root)).toPassCleanly();
    });

    it("does not fire on a project without the React Native SDK", async () => {
      const root = await project({
        "package.json": JSON.stringify({
          dependencies: { "@amplitude/analytics-browser": "^2.45.5" },
        }),
      });

      expect(checkWiring(root)).toPassCleanly();
    });
  });

  describe("invocation contract", () => {
    it("exits 2 on an unknown flag", () => {
      expect(checkWiring("--nope")).toExitWith(2);
    });

    it("exits 1 on a path that cannot be read", () => {
      expect(checkWiring("./no-such-directory-here")).toExitWith(1);
    });
  });
});
