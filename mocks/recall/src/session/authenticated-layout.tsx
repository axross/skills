import { Redirect, Stack } from "expo-router";

import { LoadingScreen } from "@/ui/loading-screen";

import { useSession } from "./session-context";

/**
 * The `(app)` group's layout: waits for the persisted session to resolve,
 * sends a signed-out learner to `/sign-in`, and otherwise renders the
 * signed-in stack.
 */
export function AuthenticatedLayout() {
  const { session, status } = useSession();

  if (status === "loading") {
    return <LoadingScreen />;
  }

  if (session === null) {
    return <Redirect href="/sign-in" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
