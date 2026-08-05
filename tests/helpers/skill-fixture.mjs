// A skill root that trips every rule the three structure validators implement.
//
// This is the input behind `skill-structure-findings.json`, the recorded set
// that proves the split of `check-skill.mjs` dropped nothing. Every rule the old
// command implemented fires against this root exactly once, so a rule that
// stops firing shows up as a missing finding rather than as a green run.
//
// It is generated rather than committed, like every other fixture here: a
// deliberately INVALID skill must never be discoverable as a real one, nor
// reachable by the format, lint, and link checks the suite runs over the tree.
//
// Changing it means re-recording the JSON beside the test, and a change that
// re-records without a matching rule change is the thing to look at twice.

import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const OK_DESC =
  "Doing the thing this fixture stands in for, whenever a task names it — a trigger phrase, a symptom, or a file it owns. Covers the shape a passing skill has.";

async function skill(root, dir, { frontmatter, body, references = {}, raw }) {
  const path = join(root, dir);
  await mkdir(path, { recursive: true });
  if (raw !== undefined) {
    await writeFile(join(path, "SKILL.md"), raw, "utf8");
  } else {
    const fm = Object.entries(frontmatter)
      .map(([k, v]) => `${k}: ${v}`)
      .join("\n");
    await writeFile(join(path, "SKILL.md"), `---\n${fm}\n---\n\n${body}`, "utf8");
  }
  if (Object.keys(references).length) {
    await mkdir(join(path, "references"), { recursive: true });
    for (const [file, text] of Object.entries(references)) {
      await writeFile(join(path, "references", file), text, "utf8");
    }
  }
}

export async function buildFixture(root) {
  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });

  // ---- frontmatter ----------------------------------------------------

  await skill(root, "no-frontmatter", { raw: "# No frontmatter\n\nProse.\n" });

  await skill(root, "name-missing", {
    frontmatter: { description: OK_DESC },
    body: "# Fixture\n\nProse.\n",
  });

  await skill(root, "Name_Not_Kebab", {
    frontmatter: { name: "Name_Not_Kebab", description: OK_DESC },
    body: "# Fixture\n\nProse.\n",
  });

  const long = `n${"o".repeat(70)}`;
  await skill(root, long, {
    frontmatter: { name: long, description: OK_DESC },
    body: "# Fixture\n\nProse.\n",
  });

  await skill(root, "name-mismatch", {
    frontmatter: { name: "different-name", description: OK_DESC },
    body: "# Fixture\n\nProse.\n",
  });

  await skill(root, "description-missing", {
    frontmatter: { name: "description-missing" },
    body: "# Fixture\n\nProse.\n",
  });

  // Every branch of readScalar: the value YAML would not read as written.
  const scalarCases = {
    "hazard-colon": "Doing a thing: and then another.",
    "hazard-comment": "Doing a thing # and then another.",
    "hazard-lead-indicator": "[Doing a thing whenever a task names it.",
    "hazard-lead-space": "- Doing a thing whenever a task names it.",
    "quote-unclosed-double": '"Doing a thing whenever a task names it.',
    "quote-unclosed-single": "'Doing a thing whenever a task names it.",
    "quote-unpaired-single": "'Doing a thing it's named for.'",
    "quote-unescaped-double": '"Doing a thing "named" for it."',
    "quote-dangling-backslash": '"Doing a thing named for it.\\"',
    "quote-short-hex": '"Doing a thing\\x1 named for it."',
    "quote-undefined-escape": '"Doing a thing\\q named for it."',
  };
  for (const [dir, description] of Object.entries(scalarCases)) {
    await skill(root, dir, {
      frontmatter: { name: dir, description },
      body: "# Fixture\n\nProse.\n",
    });
  }

  await skill(root, "description-too-long", {
    frontmatter: {
      name: "description-too-long",
      description: `Doing the thing whenever a task names it. ${"padding word ".repeat(90)}`,
    },
    body: "# Fixture\n\nProse.\n",
  });

  await skill(root, "authoring-guidelines", {
    frontmatter: { name: "authoring-guidelines", description: OK_DESC },
    body: "# Fixture\n\nProse.\n",
  });

  await skill(root, "document-voice", {
    frontmatter: {
      name: "document-voice",
      description: "This skill provides guidance for the thing, whenever a task names it.",
    },
    body: "# Fixture\n\nProse.\n",
  });

  // ---- body -----------------------------------------------------------

  await skill(root, "body-cases", {
    frontmatter: { name: "body-cases", description: OK_DESC },
    body: [
      "# Fixture",
      "",
      "Prose that demonstrates the topic before stating rules.",
      "",
      "## Abutting Section",
      "",
      "**Guidelines:**",
      "",
      "- MUST state a rule here.",
      "",
      "## Voice",
      "",
      "Prose demonstrating the topic.",
      "",
      "**Guidelines:**",
      "",
      "- Bullets in a guidelines block open with an RFC-2119 keyword, and this one does not.",
      "- MUST generally avoid the hedge above this line.",
      "",
      "## Stale Style",
      "",
      "Prose demonstrating the topic.",
      "",
      "Guidelines:",
      "",
      "- MUST be reached by a plain label rather than a bold one.",
      "",
      "```text",
      "A fenced text block.",
      "```",
      "",
      "## Placement",
      "",
      "Prose demonstrating the topic.",
      "",
      "- MUST sit outside any guidelines block.",
      "",
      "## Citation",
      "",
      "Pinned to widget-lib 4.2.1 with nothing to check it against.",
      "",
      "**Verified against** the vendor docs on a date, with no URL.",
      "",
      "**Guidelines:**",
      "",
      "- MUST cite the upstream page.",
      "",
      "## Near The Ceiling",
      "",
      "Prose demonstrating the topic.",
      "",
      "**Guidelines:**",
      "",
      ...Array.from({ length: 9 }, (_, i) => `- MUST hold near-ceiling rule ${i + 1}.`),
      "",
    ].join("\n"),
  });

  await skill(root, "bullet-ceiling", {
    frontmatter: { name: "bullet-ceiling", description: OK_DESC },
    body: [
      "# Fixture",
      "",
      "Prose.",
      "",
      "## Over The Ceiling",
      "",
      "Prose demonstrating the topic.",
      "",
      "**Guidelines:**",
      "",
      ...Array.from({ length: 11 }, (_, i) => `- MUST hold rule number ${i + 1}.`),
      "",
    ].join("\n"),
  });

  await skill(root, "oversized", {
    frontmatter: { name: "oversized", description: OK_DESC },
    body: `# Fixture\n\n${"Padding prose that pushes this document past its token budget. ".repeat(500)}\n`,
  });

  // ---- references -----------------------------------------------------

  await skill(root, "reference-cases", {
    frontmatter: { name: "reference-cases", description: OK_DESC },
    body: [
      "# Fixture",
      "",
      "Prose.",
      "",
      "## Routing",
      "",
      "See [linked.md](./references/linked.md) for:",
      "",
      "- MUST not open a routing bullet with a keyword",
      "- the flag that changes behaviour",
      "",
      "## Links",
      "",
      "Prose demonstrating the topic.",
      "",
      "An [escaping link](../body-cases/SKILL.md) and a",
      "[bad anchor](./references/linked.md#no-such-heading).",
      "",
    ].join("\n"),
    references: {
      // The same body and link rules, exercised against a reference document
      // rather than SKILL.md — a separate walk in the code being moved.
      "linked.md": [
        "# Linked",
        "",
        "## Abutting In A Reference",
        "",
        "**Guidelines:**",
        "",
        "- MUST state a rule with no demonstration above it.",
        "",
        "## Links In A Reference",
        "",
        "Prose demonstrating the topic.",
        "",
        "An [escaping link](../../body-cases/SKILL.md) and a",
        "[bad anchor](./linked.md#absent-heading).",
        "",
      ].join("\n"),
      "orphan.md": "# Orphan\n\nProse.\n",
    },
  });

  return root;
}
