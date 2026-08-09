import * as amplitude from "@amplitude/analytics-react-native";

import type { Grade } from "@/scheduler/scheduler";

// Read as this full literal expression: destructuring `process.env` or
// aliasing it to another variable defeats the bundler's inlining of
// `EXPO_PUBLIC_` variables, and the value would silently become undefined
// in a real build.
const amplitudeApiKey = process.env.EXPO_PUBLIC_AMPLITUDE_API_KEY;

/**
 * Starts the Amplitude SDK. A no-op when no API key is configured, so the
 * app runs normally with no analytics credential present. Note what is
 * *not* passed: neither `storageProvider` nor `cookieStorage` is set here,
 * so the SDK's own AsyncStorage-backed identity storage is what runs.
 */
export function initAnalytics(): void {
  if (!amplitudeApiKey) return;
  amplitude.init(amplitudeApiKey);
}

/** Identifies the signed-in learner. Called only from the sign-in path. */
export function identifyUser(accountId: string): void {
  if (!amplitudeApiKey) return;
  amplitude.setUserId(accountId);
}

/**
 * Rotates Amplitude's device and user identity. Called only from the
 * sign-out path — calling it anywhere else (say, on every app launch)
 * would rotate the device id on every launch instead of on sign-out.
 */
export function forgetUser(): void {
  if (!amplitudeApiKey) return;
  amplitude.reset();
}

export function trackScreenView(screenName: string): void {
  if (!amplitudeApiKey) return;
  amplitude.track("Screen Viewed", { screen: screenName });
}

export function trackCardGraded(params: {
  deckId: string;
  grade: Grade;
}): void {
  if (!amplitudeApiKey) return;
  amplitude.track("Card Graded", {
    deckId: params.deckId,
    grade: params.grade,
  });
}
