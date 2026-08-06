// Babel config for Jest only — nothing here builds the app, which this
// thinned fixture never runs. It exists so Jest can strip TypeScript (and
// JSX, for completeness) from the files a spec imports without pulling in a
// type checker: `npm test` cares whether the code runs, not whether it
// type-checks, which is what keeps this fixture free of the real app
// framework as a dependency.
module.exports = {
	presets: [
		["@babel/preset-env", { targets: { node: "current" } }],
		["@babel/preset-typescript", { allowDeclareFields: true }],
	],
};
