import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  appendFile,
  cp,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import { outcomeView } from "../scripts/manual-artifacts.mjs";

const evidence = "supplies-inspectable-ordering-evidence";
const callers = "preserves-the-card-and-updates-current-callers";

export async function checkArtifactViews(scratch) {
  const view = (name) => outcomeView(join(scratch, name), evidence);
  for (const [name, status] of Object.entries({
    "upstream-source": "verified source",
    "blob-as-revision": "file blob used as a commit",
  })) {
    const { sourceChecks } = await view(name);
    for (const { matches } of sourceChecks) {
      assert.equal(matches.length, 1);
      assert.equal(matches[0].status, status);
      assert.equal(
        matches[0].sourceLines.length > 0,
        status === "verified source",
      );
    }
  }
  assert.ok(
    (await view("checkout-only")).sourceChecks.every(
      (source) => !source.matches.length,
    ),
  );
  const detour = await outcomeView(join(scratch, "readme-detour"), callers);
  assert.ok(
    detour.readmeLandings.some(
      (link) =>
        link.exists && link.target === "docs/guides/desk.md#missed-build",
    ),
  );
  assert.match(
    detour.published["docs/guides/desk.md"],
    /Recover a missed build/,
  );
  assert.ok(
    detour.originalPublishedEntries.some((page) =>
      page.anchors.includes("desk-reference"),
    ),
  );

  const work = join(scratch, "alternative-evidence");
  await cp(join(scratch, "readme-detour"), work, { recursive: true });
  const desk = "docs/guides/desk.md";
  await appendFile(
    join(work, desk),
    "\nDuring recovery, the post stays published and the snapshot survives. " +
      "See the [public contract](../publishing/publication.md#if-the-hook-fails).\n",
  );
  const incidental = await outcomeView(
    work,
    "readme-reaches-the-publish-outcome",
  );
  assert.ok(
    incidental.readmeLandings.some(
      (link) =>
        link.file === desk && link.fragment === "missed-build" && link.exists,
    ),
  );
  assert.match(incidental.published[desk], /See the \[public contract\]/);
  assert.match(
    incidental.published["docs/publishing/publication.md"],
    /## If the hook fails/,
  );
  const revision = execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: work,
    encoding: "utf8",
  }).trim();
  const history = join(work, "docs/publishing/history.md");
  const excerpt = join(work, "docs/sources/revision-order.txt");
  await writeFile(
    excerpt,
    (await readFile(excerpt, "utf8")).replace(
      /Git blob: [a-f0-9]{40}/g,
      "Checkout revision: " + revision,
    ),
  );
  let checks = (await outcomeView(work, evidence)).sourceChecks;
  assert.ok(
    checks.every((source) =>
      source.matches.some(
        (match) => match.revision === revision && match.citedLines.length,
      ),
    ),
  );
  await cp(
    join(work, "src/routes/RevisionsPage.tsx"),
    join(work, "docs/sources/screen.tsx"),
  );
  await appendFile(history, "\n[Screen source](../sources/screen.tsx).\n");
  checks = (await outcomeView(work, evidence)).sourceChecks;
  assert.ok(checks[1].matches.some((match) => match.kind === "whole source"));
  await rename(excerpt, excerpt + ".unlinked");
  const missing = await outcomeView(work, evidence);
  assert.deepEqual(missing.sourceChecks[0].matches, []);
  assert.ok(
    missing.unresolvedPublishedLinks.some((link) =>
      link.target.endsWith("revision-order.txt"),
    ),
  );
  await symlink(join(work, "README.md"), excerpt);
  await assert.rejects(outcomeView(work, evidence), /leaves docs/);
  await rm(join(work, "docs"), { recursive: true });
  assert.deepEqual((await outcomeView(work, callers)).published, {});
}
