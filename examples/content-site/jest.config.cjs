/** @type {import("jest").Config} */
module.exports = {
	clearMocks: true,
	testEnvironment: "node",
	testMatch: ["<rootDir>/shared/**/*.spec.ts", "<rootDir>/app/**/*.spec.ts"],
	moduleNameMapper: {
		"^@/(.*)$": "<rootDir>/$1",
	},
};
