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
 *
 * `trackingSessionEvents` is set explicitly, not left unset: nothing this
 * app tracks — a screen view, a card graded — is a measure of session
 * length or session count, and no screen in it charts either, so a session
 * event collected here would only ever sit unread. The installed SDK
 * already defaults to `false` on this platform; writing it out here makes
 * that a decision this app made on purpose, not an accident that would go
 * unnoticed if the default ever changed.
 */
export function initAnalytics(): void {
  if (!amplitudeApiKey) return;
  amplitude.init(amplitudeApiKey, undefined, { trackingSessionEvents: false });
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
