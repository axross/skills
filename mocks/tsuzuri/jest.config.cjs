const nextJest = require("next/jest");

// The app's own compiler does the transform, so a spec importing a route
// module sees the same output the app does. Nothing here strips types by hand:
// `npm run typecheck` is what checks them, and `npm test` cares whether the
// code runs.
const createJestConfig = nextJest({ dir: "./" });

/** @type {import("jest").Config} */
const config = {
	clearMocks: true,
	testEnvironment: "node",
	testMatch: ["<rootDir>/shared/**/*.spec.ts", "<rootDir>/app/**/*.spec.ts"],
};

module.exports = createJestConfig(config);
