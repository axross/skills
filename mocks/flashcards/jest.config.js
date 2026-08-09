module.exports = {
  preset: "jest-expo",
  resolver: "react-native-worklets/jest/resolver",
  setupFiles: [
    "react-native-unistyles/mocks",
    "react-native-gesture-handler/jestSetup",
    "<rootDir>/src/theme/theme.ts",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
};
