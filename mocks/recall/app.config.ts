import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "Recall",
  slug: "recall",
  scheme: "recall",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: { supportsTablet: true, bundleIdentifier: "dev.axross.recall" },
  android: { package: "dev.axross.recall" },
  plugins: [
    "expo-router",
    [
      "expo-camera",
      {
        cameraPermission:
          "Recall uses the camera to photograph what a card is about.",
      },
    ],
  ],
};

export default config;
