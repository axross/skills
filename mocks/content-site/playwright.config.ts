import { defineConfig, devices } from "@playwright/test";

// End-to-end specs live under e2e/, apart from the unit specs colocated under
// shared/, because they exercise the whole running app rather than one module.
// The server below is the app as it is actually served — built, then started —
// rather than the dev server, so a spec that passes here passed against what a
// reader would get.
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	retries: 1,
	use: {
		baseURL: "http://localhost:3000",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "npm run build && npm run start",
		url: "http://localhost:3000",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
