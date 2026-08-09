/* global jest */
// AsyncStorage ships its own official Jest mock, but it must be wired in
// explicitly — jest-expo's preset does not do this for us.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
