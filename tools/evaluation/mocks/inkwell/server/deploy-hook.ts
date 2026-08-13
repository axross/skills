import { rootLogger } from "../shared/logger";

const logger = rootLogger.child("deploy-hook");

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 250;

export interface DeployHookResult {
  readonly ok: boolean;
  readonly attempts: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calls a site's deploy hook after a publish. Most static-hosting deploy
 * hooks are a bare POST with no body, and most are flaky enough on a cold
 * start to be worth one retry — this gives it two.
 *
 * A failed hook does not fail the publish: the post and its revision are
 * already committed by the time this runs (see routes in app.ts), so the
 * worst case is a site that doesn't rebuild on its own. The caller surfaces
 * `ok: false` to the editor rather than losing the failure silently.
 */
export async function triggerDeployHook(siteSlug: string, url: string): Promise<DeployHookResult> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      logger.debug({ siteSlug, attempt }, "Started calling the deploy hook.");
      const response = await fetch(url, { method: "POST" });
      if (!response.ok) {
        throw new Error(`Deploy hook responded with status ${response.status}.`);
      }
      logger.info({ siteSlug, attempt }, "Completed calling the deploy hook.");
      return { ok: true, attempts: attempt };
    } catch (error) {
      lastError = error;
      const reason = error instanceof Error ? error.message : String(error);
      logger.warn({ siteSlug, attempt, reason }, "Deploy hook call failed; retrying.");
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempt);
    }
  }

  const reason = lastError instanceof Error ? lastError.message : String(lastError);
  logger.error(
    { siteSlug, attempts: MAX_ATTEMPTS, reason },
    "Deploy hook failed after every retry.",
  );
  return { ok: false, attempts: MAX_ATTEMPTS };
}
