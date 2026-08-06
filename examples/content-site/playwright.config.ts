import { defineConfig } from "@playwright/test";

// Config only — this thinned fixture does not install `@playwright/test` or
// the app framework it would drive, so `test:e2e` is not wired into
// package.json here. What matters for this fixture is the STRUCTURE: end-to-end
// specs live under e2e/, apart from the unit specs colocated under shared/, so
// a reader still has to notice the split rather than infer it from one folder.
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: true,
	retries: 1,
	use: {
		baseURL: "http://localhost:3000",
	},
});
