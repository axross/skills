// Shared CLI, frontmatter and Markdown reader for the three docs checks.
import { readdir, readFile, stat } from "node:fs/promises";
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
const validators = [
  ["check-index.mjs", "document reachability and OKF concept kinds"],
  ["check-references.mjs", "relative links and Markdown fragments"],
  ["check-glossary.mjs", "legacy spec/glossary pairing"],
];

export function siblingHelp(self) {
  return (
    "\nRelated checks:\n" +
    validators
      .filter(([name]) => name !== self)
      .map(([name, what]) => `  ${name.padEnd(30)} ${what}`)
      .join("\n")
  );
}

export function selfName(url) {
  return basename(new URL(url).pathname);
}

export function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Preserve the dependency-free legacy contract: inline destinations and ATX
// level-two glossary headings. Rich text, YAML and fragments belong to OKF.
function readLegacy(text) {
  const headings = [],
    links = [];
  let fence;
  for (const [i, line] of text.split("\n").entries()) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)?.[1];
    if (fence) {
      if (marker?.startsWith(fence)) fence = undefined;
      continue;
    }
    if (marker) {
      fence = marker;
      continue;
    }
    const prose = line.replace(/`[^`]*`/g, "");
    const heading = prose.match(/^##\s+(.+?)\s*#*\s*$/);
    if (heading) headings.push({ level: 2, text: heading[1].trim() });
    for (const match of prose.matchAll(
      /(!?)\[[^\]]*\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g,
    )) {
      if (!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(match[2]))
        links.push({ target: match[2], line: i + 1, image: !!match[1] });
    }
  }
  return { headings, links };
}

async function listDocuments(dir) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await listDocuments(path)));
    else if (entry.isFile() && path.endsWith(".md")) files.push(path);
  }
  return files;
}

// Detect ordinary top-level OKF keys before loading the optional parsers. Indented
// block values and nested flow mappings can have their own unrelated "type".
function hasOkfMarker(text, rootIndex) {
  if (!/^---[ \t]*\r?\n/.test(text)) return false;
  const header = text.split(/^---[ \t]*\r?$/m, 3)[1] ?? "";
  const content = header.replace(/^\s*#[^\n]*$/gm, "");
  const first = content.match(/^([ ]*)(\S.*)$/m);
  if (!first) return false;
  const key = rootIndex ? "(?:type|okf_version)" : "type";
  const marker = new RegExp(`^(?:"${key}"|'${key}'|${key})[ \\t]*:`);
  if (!first[2].startsWith("{"))
    return content
      .split("\n")
      .some(
        (line) =>
          line.startsWith(first[1]) && marker.test(line.slice(first[1].length)),
      );

  // At depth one, only the text after the opening brace or a comma can be
  // the next root key. Skip quoted scalars and comments as whole tokens.
  let depth = 0;
  for (const token of content.matchAll(
    /"(?:\\[\s\S]|[^"\\])*"|'(?:''|[^'])*'|(?:^|\s)#[^\n]*|[{},\[\]]/gm,
  )) {
    const part = token[0];
    if (part === "{" || part === "[") depth++;
    if (depth === 1 && (part === "{" || part === ",")) {
      const tail = content
        .slice(token.index + 1)
        .replace(/^(?:\s|#[^\n]*\n)*/, "");
      if (marker.test(tail)) return true;
    }
    if (part === "}" || part === "]") depth--;
  }
  return false;
}

export async function loadDocs(dir) {
  const root = resolve(dir);
  const indexPath = join(root, "index.md");
  if (!(await stat(indexPath).catch(() => null))?.isFile()) return null;
  const documents = await Promise.all(
    (await listDocuments(root)).sort().map(async (path) => ({
      path,
      relative: relative(root, path).split(sep).join("/"),
      text: (await readFile(path, "utf8")).replace(/^\uFEFF/, ""),
    })),
  );
  // Only an initial YAML block can select OKF. Legacy trees still run from
  // a copied skill with Node alone, including --help and the no-index opt-out.
  const candidate = documents.some((doc) =>
    hasOkfMarker(doc.text, doc.path === indexPath),
  );
  let reader = readLegacy;
  if (candidate) {
    try {
      reader = (await import("./okf.mjs")).readMarkdown;
    } catch (error) {
      if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
      throw new Error(
        "OKF checks require dependencies. Run npm ci --ignore-scripts in the skill's scripts directory.",
      );
    }
  }
  for (const doc of documents) Object.assign(doc, reader(doc.text));
  const byPath = new Map(documents.map((doc) => [doc.path, doc]));
  const index = byPath.get(indexPath);
  const okf =
    index.meta?.has("okf_version") ||
    documents.some(
      (doc) =>
        doc.meta?.has("type") ||
        (doc.metadataError && hasOkfMarker(doc.text, doc.path === indexPath)),
    );
  return { root, documents, byPath, index, okf };
}

// Refuse escaping paths before consulting the filesystem in OKF mode.
export function resolveLink(docs, doc, target) {
  const hash = target.indexOf("#");
  const rawPath = (hash < 0 ? target : target.slice(0, hash)).split("?")[0];
  try {
    const decoded = decodeURIComponent(rawPath);
    const fragment = hash < 0 ? "" : decodeURIComponent(target.slice(hash + 1));
    let path = doc.path;
    if (decoded.startsWith("/") && docs.okf)
      path = resolve(docs.root, "." + decoded);
    else if (decoded) path = resolve(dirname(doc.path), decoded);
    if (docs.okf && !withinRoot(docs.root, path))
      return { error: "leaves the bundle; use a source URL" };
    return { path, fragment };
  } catch {
    return { error: "has invalid URI encoding" };
  }
}

export function withinRoot(root, path) {
  const diff = relative(root, path);
  return diff !== ".." && !diff.startsWith(".." + sep) && !isAbsolute(diff);
}

export async function main({ usage, allowEvidence = false, run, pass }) {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(usage);
    return 0;
  }
  const evidence = new Set();
  let dir;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (
      allowEvidence &&
      arg === "--evidence" &&
      argv[i + 1] &&
      !argv[i + 1].startsWith("-")
    ) {
      evidence.add(argv[++i]);
    } else if (arg.startsWith("-") || dir !== undefined) {
      console.error(usage);
      return 2;
    } else dir = arg;
  }
  dir ??= "docs";
  try {
    const docs = await loadDocs(dir);
    if (!docs) {
      console.log(`No docs at ${dir} (no index.md). Nothing to check.`);
      return 0;
    }
    const findings = await run(docs, evidence);
    if (!findings.length) {
      console.log(`PASS  ${dir}\n\n${pass(docs)}`);
      return 0;
    }
    console.log(`FAIL  ${dir}`);
    for (const { category, message } of findings)
      console.log(`        - ${category}: ${message}`);
    console.log(
      `\n${dir} has ${findings.length} finding${findings.length === 1 ? "" : "s"}.`,
    );
    return 1;
  } catch (error) {
    console.error(`Could not check ${dir}: ${error.message}`);
    return 2;
  }
}
