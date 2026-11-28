import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import {
  loadDocs,
  resolveLink,
} from "../../../../../skills/living-project-documentation/scripts/docs.mjs";

export async function checkFlatControl({
  scratch,
  setupPatch,
  checkStructure,
}) {
  const input = join(scratch, "coherent-flat-input");
  const output = join(scratch, "coherent-flat-output");
  await cp(join(scratch, "repaired"), input, {
    recursive: true,
    filter: (path) => basename(path) !== ".git",
  });
  execFileSync("git", ["apply", setupPatch], { cwd: input });
  await cp(input, output, { recursive: true });
  const diff = execFileSync(
    "git",
    ["diff", "--no-index", "--", input, output],
    { encoding: "utf8" },
  );
  assert.equal(diff, "");
  await writeFile(join(scratch, "coherent-flat-changes.diff"), diff);

  await checkStructure(input, "coherent-flat-input");
  await checkStructure(output, "coherent-flat-output");
  const docs = await loadDocs(join(output, "docs"), undefined, {
    wholeRoot: true,
  });
  for (const [label, target] of [
    ["What a publish commits", "./publication.md"],
    ["Reading and ordering revisions", "./history.md"],
    ["Revision history", "./history.md"],
    ["Site delivery", "./delivery.md"],
  ]) {
    assert.ok(docs.index.text.includes(`[${label}](${target})`), label);
    const landing = await resolveLink(docs, docs.index, target);
    assert.ok(landing.page, target);
  }
  const pageText = (path) =>
    docs.byPath.get(join(docs.root, path)).text.replace(/\s+/g, " ");
  assert.match(
    pageText("publication.md"),
    /author still has the published post and revision/,
  );
  assert.match(
    pageText("history.md"),
    /share a second, the higher revision ID appears first/,
  );
  assert.match(
    pageText("index.md"),
    /Place a new rule for the revision list in \[Revision history\]/,
  );
  const recovery = pageText("delivery.md").split(
    "## Recover a missed build ",
  )[1];
  assert.match(
    recovery,
    /Check the site's hosting dashboard for this publication\. If its build is queued or running, stop and follow that build\. Otherwise trigger one rebuild from the host dashboard/,
  );
  return { workspace: output, docs };
}
