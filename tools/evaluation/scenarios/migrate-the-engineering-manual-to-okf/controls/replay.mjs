import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadDocs,
  resolveLink,
  slug,
} from "../../../../../skills/living-project-documentation/scripts/docs.mjs";
import { readMarkdown } from "../../../../../skills/living-project-documentation/scripts/okf.mjs";
import { checkFlatControl } from "./flat-control.mjs";
import { judgeFactor } from "../../../src/factor-judgment.mjs";
import { materialize } from "../../../src/mock-workspace.mjs";
import { checkArtifactViews } from "./artifact-views.mjs";
import { loadScenario } from "../../../src/scenario.mjs";

if (process.argv.length !== 3)
  throw new Error("Usage: node replay.mjs <pinned validate.py>");

const validator = resolve(process.argv[2]);
const controls = fileURLToPath(new URL("./", import.meta.url));
const scenario = await loadScenario(resolve(controls, ".."));
const checker = resolve(
  controls,
  "../../../../../skills/living-project-documentation/scripts/check-docs.mjs",
);
const scratch = await mkdtemp(join(tmpdir(), "inkwell-manual-"));
console.log(`Control workspaces and checker reports: ${scratch}`);

const baseline = await materialize({
  mock: scenario.mock,
  patch: join(scenario.dir, scenario.patch),
  agentsMd: scenario.harness.agentsMd,
});
const discovery = scenario.factors.find(({ phase }) => phase === "discovery");
const receipt = scenario.factors.find(
  ({ phase, judgment }) => phase === "outcome" && judgment.method === "script",
);

async function checkFactor(factor, workspace, probe, expected) {
  const outcome = await judgeFactor(factor, {
    scenarioDir: scenario.dir,
    workspace,
    probe,
  });
  assert.equal(outcome.result, expected, JSON.stringify(outcome));
}

const variants = {
  metadata: ["metadata"],
  renamed: ["metadata", "renamed"],
  "index-only": ["metadata", "index-only"],
  repaired: ["repaired"],
  "readme-detour": ["repaired", "readme-detour"],
  "old-index": ["repaired", "old-index"],
  "over-split": ["repaired", "over-split"],
  unsupported: ["repaired", "unsupported"],
  staged: ["metadata", "staged"],
  "stale-callers": ["repaired", "stale-callers"],
  "missing-rationale": ["repaired", "missing-rationale"],
  "checkout-only": ["repaired", "checkout-only"],
  "upstream-source": ["repaired", "checkout-only", "upstream-source"],
  "blob-as-revision": [
    "repaired",
    "checkout-only",
    "upstream-source",
    "blob-as-revision",
  ],
};

const permittedPages = [
  "specs/index.md",
  "specs/post-records.md",
  "guides/index.md",
  "deploy-hooks.md",
];
const permittedFragments = [
  "guides/desk.md#desk-reference",
  "guides/desk.md#reading-history",
];
const card = "guides/desk.md#missed-build";
const original = await loadDocs(join(baseline, "docs"), undefined, {
  wholeRoot: true,
});
const decision = await readFile(
  join(baseline, "maintenance/decisions.md"),
  "utf8",
);
for (const route of [...permittedPages, ...permittedFragments, card])
  assert.ok(decision.includes("`" + route + "`"), route);

function publishedRoutes(docs) {
  return docs.documents.flatMap(({ relative, anchors }) => [
    relative,
    ...Array.from(anchors, (anchor) => relative + "#" + anchor),
  ]);
}

const protectedRoutes = publishedRoutes(original).filter(
  (route) =>
    !permittedPages.includes(route.split("#")[0]) &&
    !permittedFragments.includes(route),
);

async function checkCallerRoutes(workspace, docs, name, repaired) {
  const publication = docs.documents.find((page) =>
    page.anchors.has("publication-transaction"),
  );
  const callers = {
    "server/app.ts": "if-the-hook-fails",
    "server/db/queries.test.ts": "publication-transaction",
    "vite.config.ts": "if-the-hook-fails",
  };
  for (const [file, fragment] of Object.entries(callers)) {
    const text = await readFile(join(workspace, file), "utf8");
    const links = text.match(/docs\/[\w./-]+\.md(?:#[\w-]+)?/g) ?? [];
    if (repaired && name !== "stale-callers") {
      assert.ok(publication?.anchors.has(fragment), file + ": missing answer");
      assert.deepEqual(
        links,
        ["docs/" + publication.relative + "#" + fragment],
        file,
      );
    } else {
      assert.deepEqual(links, ["docs/deploy-hooks.md"], file);
      assert.equal(
        docs.byPath.has(join(docs.root, "deploy-hooks.md")),
        name !== "stale-callers",
        file,
      );
    }
  }
}

async function checkReadmeRoute(workspace, docs, expected) {
  const path = join(workspace, "README.md");
  const text = await readFile(path, "utf8");
  const lines = text.split("\n");
  const links = readMarkdown(text).links.filter(({ line }) =>
    lines[line - 1].includes(
      "what a failed hook means for a published revision",
    ),
  );
  assert.equal(links.length, 1, path);
  const { page, fragment } = await resolveLink(docs, { path }, links[0].target);
  assert.ok(page?.anchors.has(fragment), links[0].target);
  const section = page.text.split(/^(?=#{1,6} )/m).find((part) => {
    const heading = part.match(/^#{1,6} (.+)/);
    return heading && slug(heading[1]) === fragment;
  });
  assert.ok(section, links[0].target);
  assert.equal(
    section.includes("the author still has the published post and revision"),
    expected,
    links[0].target,
  );
}

async function checkStructure(workspace, name) {
  const report = execFileSync(
    process.execPath,
    [checker, "--validator", validator, "docs"],
    { cwd: workspace, encoding: "utf8" },
  );
  await writeFile(join(scratch, name + ".log"), report);
}

async function checkOrderEvidence(docs, expected) {
  const owner = docs.documents.find((page) =>
    /(?:higher|lower) revision\s+ID (?:appears|comes) first/.test(page.text),
  );
  const evidence = owner?.links.find((link) =>
    link.target.endsWith("revision-order.txt"),
  );
  assert.equal(Boolean(evidence), expected, "exported source link");
  if (!evidence) return;

  const contents = await readFile(
    resolve(dirname(owner.path), evidence.target),
    "utf8",
  );
  const sections = contents.trimEnd().split(/(?=^Source: )/m);
  const sources = [
    [
      "server/app.ts",
      [".orderBy(desc(revisions.createdAt), desc(revisions.id))"],
    ],
    [
      "src/routes/RevisionsPage.tsx",
      [
        "for (const revision of revisions)",
        "group.revisions.push(revision)",
        "revisions: [revision]",
      ],
    ],
  ];
  assert.equal(sections.length, sources.length);
  for (const [index, [path, operations]] of sources.entries()) {
    const blob = execFileSync("git", ["rev-parse", "HEAD:" + path], {
      cwd: baseline,
      encoding: "utf8",
    }).trim();
    const heading = "Source: " + path + "\nGit blob: " + blob + "\n\n";
    assert.ok(
      sections[index].startsWith(heading),
      path + ": incorrect source identity",
    );
    const excerpt = sections[index].slice(heading.length).trimEnd();
    assert.ok(
      operations.every((operation) => excerpt.includes(operation)),
      path + ": missing ordering operation",
    );
    const originalText = execFileSync("git", ["cat-file", "blob", blob], {
      cwd: baseline,
      encoding: "utf8",
    });
    assert.ok(
      originalText.includes(excerpt),
      path + ": excerpt differs from cited blob",
    );
  }
}

try {
  for (const [name, patches] of Object.entries(variants)) {
    const workspace = join(scratch, name);
    await cp(baseline, workspace, { recursive: true });
    for (const patch of patches) {
      execFileSync("git", ["apply", join(controls, patch + ".diff")], {
        cwd: workspace,
      });
    }
    await checkStructure(workspace, name);
    const docs = await loadDocs(join(workspace, "docs"), undefined, {
      wholeRoot: true,
    });
    const published = new Set(publishedRoutes(docs));
    const lost = protectedRoutes.filter((route) => !published.has(route));
    assert.deepEqual(
      lost.sort(),
      name === "renamed" ? ["guides/desk.md", card] : [],
      name,
    );
    const repaired = patches[0] === "repaired";
    await checkCallerRoutes(workspace, docs, name, repaired);
    await checkReadmeRoute(
      workspace,
      docs,
      repaired && name !== "readme-detour",
    );
    if (name === "readme-detour") {
      assert.equal(
        await readFile(join(workspace, "README.md"), "utf8"),
        await readFile(join(baseline, "README.md"), "utf8"),
        "the isolated README failure must have no README diff against the actor input",
      );
    }
    await checkOrderEvidence(
      docs,
      (repaired && !patches.includes("checkout-only")) || name === "staged",
    );
    if (repaired) {
      const retryOwner = docs.documents.find((page) =>
        page.anchors.has("hook-delivery"),
      );
      assert.ok(retryOwner, name);
      assert.equal(
        retryOwner.text.includes("cold host"),
        name !== "missing-rationale",
        name,
      );
      assert.equal(
        retryOwner.text.includes("deleted or misconfigured hook"),
        name !== "missing-rationale",
        name,
      );
    }
    await checkFactor(
      receipt,
      workspace,
      { diff: "", task: scenario.task },
      true,
    );
    console.log(`${name}: structural pass, receipt preserved`);
  }
  const valid = await readFile(
    join(scratch, "upstream-source/docs/publishing/history.md"),
    "utf8",
  );
  const invalid = await readFile(
    join(scratch, "blob-as-revision/docs/publishing/history.md"),
    "utf8",
  );
  const commit = "99e6407460d4e477a1a0690e40bee8f7079acbf2";
  const queryBlob = execFileSync("git", ["rev-parse", "HEAD:server/app.ts"], {
    cwd: baseline,
    encoding: "utf8",
  }).trim();
  const locators = valid.match(/https:\/\/github\.com\/[^)]+/g) ?? [];
  assert.equal(locators.length, 2);
  for (const url of locators)
    assert.ok(url.includes("/blob/" + commit + "/"), url);
  await checkArtifactViews(scratch);
  assert.equal(
    invalid,
    valid.replaceAll(commit, queryBlob),
    "only the repository revision should differ",
  );
  const flat = await checkFlatControl({
    scratch,
    setupPatch: join(controls, "coherent-flat.diff"),
    checkStructure,
  });
  await checkOrderEvidence(flat.docs, true);
  await checkReadmeRoute(flat.workspace, flat.docs, true);
  await checkCallerRoutes(flat.workspace, flat.docs, "coherent-flat", true);
  await checkFactor(
    receipt,
    flat.workspace,
    { diff: "", task: scenario.task },
    true,
  );
  console.log(
    "coherent-flat: identical input and output; reader, placement, stop and evidence verified",
  );
  await checkFactor(
    discovery,
    baseline,
    { skillsInvoked: scenario.targetSkills },
    true,
  );
  await checkFactor(
    discovery,
    baseline,
    { skillsInvoked: scenario.peerSkills },
    false,
  );
  const path = join(baseline, receipt.judgment.input.files[0].path);
  await writeFile(path, "changed receipt\n");
  await checkFactor(
    receipt,
    baseline,
    { diff: "", task: scenario.task },
    false,
  );
  await rm(path);
  await checkFactor(
    receipt,
    baseline,
    { diff: "", task: scenario.task },
    false,
  );
  console.log(
    "Discovery selected/absent and receipt altered/missing controls passed.",
  );
} finally {
  await rm(baseline, { recursive: true, force: true });
}
