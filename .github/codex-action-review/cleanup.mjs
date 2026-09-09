import { lstat, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assertReviewDirectory } from "./prepare-context.mjs";

/** removes the private review directory without following a caller-selected path. */
export async function cleanupReviewDirectory(reviewDirectory, runnerTemp) {
  const path = assertReviewDirectory(reviewDirectory, runnerTemp);
  await rm(path, { force: true, recursive: true });
  try {
    await lstat(path);
    throw new Error("review-directory-cleanup-failed");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function run(environment = process.env) {
  try {
    await cleanupReviewDirectory(
      environment.REVIEW_DIRECTORY,
      environment.RUNNER_TEMP,
    );
  } catch {
    process.stderr.write("Review cleanup failed\n");
    process.exitCode = 1;
  }
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await run();
}
