import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: ["dist", "coverage", "server/db/migrations", ".vite"],
  },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    // Frontend: browser globals, plus the two React-specific plugins.
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // API, database, and build/test config: Node globals, no React rules.
    files: [
      "server/**/*.ts",
      "shared/**/*.ts",
      "*.config.ts",
      "*.config.js",
      "vite.config.ts",
      "vitest.config.ts",
      "drizzle.config.ts",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  eslintConfigPrettier,
);
