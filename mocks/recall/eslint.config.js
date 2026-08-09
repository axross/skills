const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier/flat");

module.exports = [
  ...expoConfig,
  prettierConfig,
  { ignores: ["node_modules/**", "android/**", "ios/**", ".expo/**"] },
];
