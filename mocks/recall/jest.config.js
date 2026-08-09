// package.json pins two things this comment explains, since package.json
// itself can't carry one:
// - `@testing-library/react-native` is held to major 14 because that's what
//   `expo-router/testing-library`'s route-rendering helpers (peer dep
//   `>= 13.2.0`) support against this SDK; a later major can change whether
//   rendering is synchronous and break every route test at once.
// - `test-renderer` (not `react-test-renderer`, which React 19 deprecated)
//   is `@testing-library/react-native@14`'s own renderer peer dependency,
//   and its version must track the installed React version exactly.
module.exports = {
  preset: "jest-expo",
  resolver: "react-native-worklets/jest/resolver",
  setupFiles: [
    "react-native-unistyles/mocks",
    "react-native-gesture-handler/jestSetup",
    "<rootDir>/src/theme/theme.ts",
    "<rootDir>/jest.setup.js",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
