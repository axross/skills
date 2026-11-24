import { readFile, realpath, stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { resolveLink, slug } from "./docs.mjs";

/** return a parsed nonempty YAML 1.2 type. */
export function declaredType(doc) {
  if (doc?.metadataError) return;
  const type = doc?.meta?.get("type");
  if (typeof type === "string" && type.trim()) return type;
}

/**
 * include an upstream untyped path that has no living-page entry of its own.
 * @throws if a path reported by the validator can no longer be resolved.
 */
export async function livingPages(docs, upstreamUntyped = []) {
  const pages = new Map(
    docs.documents
      .filter((doc) => doc.living)
      .map((doc) => [doc.relative, doc]),
  );
  for (const name of upstreamUntyped) {
    if (pages.has(name)) continue;
    const path = await realpath(join(docs.root, name));
    const doc = docs.byPath.get(path);
    // a typed alias is already reviewed under its canonical name. untyped aliases
    // each need an exact path decision, even when they point at accepted evidence.
    if (!doc?.living || !declaredType(doc)) pages.set(name, doc);
  }
  return pages;
}

/**
 * follow index routes and include named evidence cited by reachable companions.
 * @throws on unexpected filesystem errors while resolving a route.
 */
async function reachable(docs, evidence) {
  const reached = new Set([docs.index.path]);
  const pending = [docs.index];
  while (pending.length) {
    const index = pending.pop();
    for (const link of index.links) {
      if (link.html || link.image || link.field) continue;
      const { page: doc } = await resolveLink(docs, index, link.target);
      if (!doc || reached.has(doc.path)) continue;
      reached.add(doc.path);
      if (docs.okf && basename(doc.path) === "index.md") pending.push(doc);
    }
  }
  // a named source is discoverable through its indexed companion.
  if (docs.okf && evidence.size) {
    for (const page of docs.documents) {
      if (
        !reached.has(page.path) ||
        page.markerKey !== "type" ||
        !page.meta?.has("type")
      )
        continue;
      for (const link of page.links) {
        if (
          link.html ||
          link.image ||
          (link.field && !link.field.startsWith("sources."))
        )
          continue;
        const { page: source } = await resolveLink(docs, page, link.target);
        if (source && evidence.has(source.relative)) reached.add(source.path);
      }
    }
  }
  return reached;
}

/**
 * report unreachable pages and metadata findings, honoring exact evidence exceptions.
 * @throws if the bundle's navigation cannot be inspected.
 */
export async function checkIndex(docs, evidence, pages) {
  const reached = docs.index ? await reachable(docs, evidence) : undefined;
  const findings = [];
  if (!docs.index && docs.populated)
    findings.push({
      category: "index",
      message: "index.md is missing from the populated documentation root",
    });
  const unused = new Set(evidence);
  for (const doc of docs.documents) {
    if (
      reached &&
      !reached.has(doc.path) &&
      !(docs.okf && basename(doc.path) === "log.md")
    ) {
      findings.push({
        category: "unindexed",
        message: `${doc.relative} is not linked from index.md`,
      });
    }
    if (!docs.okf) continue;
    if (doc.metadataError)
      findings.push({
        category: "frontmatter",
        message: `${doc.relative}: ${doc.metadataError}`,
      });
  }
  if (docs.okf)
    for (const [name, doc] of pages ?? (await livingPages(docs))) {
      if (declaredType(doc)) continue;
      if (doc && !doc.meta?.has("type") && unused.delete(name)) {
        console.log(`WARN  ${name}: named untyped evidence`);
      } else {
        findings.push({
          category: "type",
          message: `${name} needs a nonempty string type`,
        });
      }
    }
  for (const name of unused)
    findings.push({
      category: "evidence",
      message: `${name} does not name an untyped evidence document`,
    });
  return findings;
}

/**
 * report unresolved local destinations with their source line and field.
 * @throws if a destination cannot be inspected due to a filesystem error.
 */
export async function checkReferences(docs, sourceRoot) {
  const findings = [];
  const sourceAnchors = new Map();

  for (const doc of docs.documents) {
    for (const link of doc.links) {
      const { target, line, field } = link;
      let { path, page, fragment, error, sourceLink } = link.error
        ? link
        : await resolveLink(docs, doc, target, field ? undefined : sourceRoot);
      if (!error && sourceLink && link.image)
        error = "is an embedded image outside the bundle";
      if (!error && field === "license" && !(await stat(path)).isFile())
        error = "does not resolve to a license file";
      if (
        !error &&
        docs.okf &&
        fragment &&
        (page || path.toLowerCase().endsWith(".md"))
      ) {
        let anchors = page?.anchors;
        if (!anchors && sourceLink && (await stat(path)).isFile()) {
          if (!sourceAnchors.has(path)) {
            const { readMarkdown } = await import("./okf.mjs");
            const text = await readFile(path, "utf8");
            sourceAnchors.set(path, readMarkdown(text).anchors);
          }
          anchors = sourceAnchors.get(path);
        }
        if (!anchors?.has(fragment)) error = "has no matching fragment";
      }
      if (error)
        findings.push({
          category: field ?? "link",
          message: `${doc.relative}:${line} → ${target} ${error}`,
        });
    }
  }
  return findings;
}

/** report legacy domains missing their single glossary heading. */
export function checkGlossary(docs) {
  if (docs.hasMarker) return [];
  const specs = docs.documents.filter((doc) =>
    doc.relative.startsWith("specs/"),
  );
  if (specs.length === 0) return [];

  const glossary = docs.documents.find((doc) => doc.relative === "glossary.md");
  if (!glossary) {
    return [
      {
        category: "glossary",
        message: `glossary.md is missing, so none of the ${specs.length} spec(s) has anywhere to define its terms`,
      },
    ];
  }

  const headings = new Set(
    glossary.headings
      .filter(({ level }) => level === 2)
      .map(({ text }) => slug(text)),
  );
  const findings = [];

  for (const spec of specs) {
    const stem = spec.relative.slice("specs/".length, -".md".length);
    if (stem.includes("/")) {
      findings.push({
        category: "nested",
        message: `${spec.relative} is nested; specs/ is flat so one domain maps to one heading`,
      });
      continue;
    }
    if (!headings.has(slug(stem))) {
      findings.push({
        category: "glossary",
        message: `${spec.relative} has no matching heading in glossary.md`,
      });
    }
  }

  return findings;
}
