import * as amplitude from "@amplitude/analytics-react-native";

jest.mock("@amplitude/analytics-react-native", () => ({
  init: jest.fn(),
  setUserId: jest.fn(),
  reset: jest.fn(),
  track: jest.fn(),
}));

// The module reads `process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY` once, at
// import time, so each case re-requires it inside `jest.isolateModules`
// after setting the environment variable it wants that import to observe.
function loadAnalytics(): typeof import("./analytics") {
  let loaded!: typeof import("./analytics");
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    loaded = require("./analytics");
  });
  return loaded;
}

describe("analytics", () => {
  const originalKey = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;

  afterEach(() => {
    process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY = originalKey;
    jest.clearAllMocks();
  });

  describe("with no API key configured", () => {
    beforeEach(() => {
      delete process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;
    });

    it("makes every function a no-op", () => {
      const analytics = loadAnalytics();
      analytics.initAnalytics();
      analytics.identifyUser("account-1");
      analytics.forgetUser();
      analytics.trackScreenView("Deck List");
      analytics.trackCardGraded({
        deckId: "world-capitals",
        grade: "recalled",
      });

      expect(amplitude.init).not.toHaveBeenCalled();
      expect(amplitude.setUserId).not.toHaveBeenCalled();
      expect(amplitude.reset).not.toHaveBeenCalled();
      expect(amplitude.track).not.toHaveBeenCalled();
    });
  });

  describe("with an API key configured", () => {
    beforeEach(() => {
      process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY = "test-key";
    });

    it("initialises the SDK with the key and a deliberate session-tracking choice", () => {
      loadAnalytics().initAnalytics();

      expect(amplitude.init).toHaveBeenCalledWith("test-key", undefined, {
        trackingSessionEvents: false,
      });
    });

    it("identifies the signed-in learner by calling setUserId", () => {
      loadAnalytics().identifyUser("account-1");

      expect(amplitude.setUserId).toHaveBeenCalledWith("account-1");
      expect(amplitude.reset).not.toHaveBeenCalled();
    });

    it("forgets the learner by calling reset", () => {
      loadAnalytics().forgetUser();

      expect(amplitude.reset).toHaveBeenCalledTimes(1);
      expect(amplitude.setUserId).not.toHaveBeenCalled();
    });

    it("tracks a screen view", () => {
      loadAnalytics().trackScreenView("Deck List");

      expect(amplitude.track).toHaveBeenCalledWith("Screen Viewed", {
        screen: "Deck List",
      });
    });

    it("tracks a card grade", () => {
      loadAnalytics().trackCardGraded({
        deckId: "world-capitals",
        grade: "forgotten",
      });

      expect(amplitude.track).toHaveBeenCalledWith("Card Graded", {
        deckId: "world-capitals",
        grade: "forgotten",
      });
    });
  });
});
