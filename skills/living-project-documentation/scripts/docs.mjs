/** shared CLI and document inventory for the three documentation checks. */
import { readdir, readFile, realpath, stat } from "node:fs/promises";
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

/** list the other checks available from the same standalone installation. */
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

/** normalize a legacy domain heading for comparison with its spec filename. */
export function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** extract inline destinations and ATX level-two headings without parser dependencies. */
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

/**
 * collect Markdown files, optionally deferring hidden entries until the format is known.
 * @throws if a directory cannot be read.
 */
async function listDocuments(dir, deferred) {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (deferred && entry.name.startsWith(".")) {
      if (entry.isDirectory()) deferred.directories.push(path);
      else if (entry.isFile() && path.endsWith(".md"))
        deferred.files.push(path);
      continue;
    }
    if (entry.isDirectory())
      files.push(...(await listDocuments(path, deferred)));
    else if (entry.isFile() && path.endsWith(".md")) files.push(path);
  }
  return files;
}

/** recognize top-level OKF keys when header parsing fails or YAML is unavailable. */
function hasOkfMarker({ text, markerKey: key }) {
  if (!key || !/^---[ \t]*\r?\n/.test(text)) return false;
  const header = text.split(/^---[ \t]*\r?$/m, 3)[1] ?? "";
  const content = header.replace(/^\s*#[^\n]*$/gm, "");
  const first = content.match(/^([ ]*)(\S.*)$/m);
  if (!first) return false;
  const marker = new RegExp(`^(?:\\?\\s+)?(?:"${key}"|'${key}'|${key})\\s*:`);
  const explicitKey = new RegExp(
    `^\\?[ \\t]+(?:"${key}"|'${key}'|${key})[ \\t]*$`,
  );
  if (!first[2].startsWith("{"))
    return content
      .split("\n")
      .some(
        (line) =>
          line.startsWith(first[1]) &&
          (marker.test(line.slice(first[1].length)) ||
            explicitKey.test(line.slice(first[1].length))),
      );

  // at depth one, only the text after the opening brace or a comma can be
  // the next root key. skip quoted scalars and comments as whole tokens.
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

/**
 * return the parsed OKF or legacy inventory, or null when no root index is available.
 * @throws if bundle contents cannot be read, the index is outside the inventory,
 * or a recognized OKF bundle cannot load its parsers.
 */
export async function loadDocs(dir) {
  if (!(await stat(join(dir, "index.md")).catch(() => null))?.isFile())
    return null;
  const root = await realpath(dir);
  const indexPath = join(root, "index.md");
  const deferred = { directories: [], files: [] };
  /**
   * read pages in stable order with bundle-relative names for diagnostics.
   * @throws if an inventoried file cannot be read.
   */
  async function readDocuments(paths) {
    return Promise.all(
      paths.sort().map(async (path) => ({
        path,
        relative: relative(root, path).split(sep).join("/"),
        text: (await readFile(path, "utf8")).replace(/^\uFEFF/, ""),
      })),
    );
  }
  const documents = await readDocuments(await listDocuments(root, deferred));
  const byPath = new Map(documents.map((doc) => [doc.path, doc]));
  const index = byPath.get(indexPath) ?? byPath.get(await realpath(indexPath));
  if (!index)
    throw new Error(
      "index.md does not resolve to a visible Markdown document in the bundle",
    );
  for (const doc of documents) {
    if (doc === index) doc.markerKey = "okf_version";
    else if (!["index.md", "log.md"].includes(basename(doc.path)))
      doc.markerKey = "type";
  }
  let readMarkdown;
  if (documents.some((doc) => /^---[ \t]*\r?\n/.test(doc.text))) {
    try {
      ({ readMarkdown } = await import("./okf.mjs"));
    } catch (error) {
      if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
      if (documents.some(hasOkfMarker))
        throw new Error(
          "OKF checks require dependencies. Run npm ci --ignore-scripts in the skill's scripts directory.",
        );
    }
  }
  if (readMarkdown) {
    for (const doc of documents)
      Object.assign(doc, readMarkdown(doc.text, doc.markerKey));
  }
  const okf = documents.some(
    (doc) =>
      doc.meta?.has(doc.markerKey) || (doc.metadataError && hasOkfMarker(doc)),
  );
  if (!okf) {
    // legacy inventory includes hidden Markdown. OKF excludes hidden entries
    // entirely, so only descend into the deferred directories in legacy mode.
    for (const dir of deferred.directories)
      deferred.files.push(...(await listDocuments(dir)));
    for (const doc of await readDocuments(deferred.files)) {
      documents.push(doc);
      byPath.set(doc.path, doc);
    }
    for (const doc of documents) Object.assign(doc, readLegacy(doc.text));
  }
  return { root, documents, byPath, index, okf };
}

/**
 * resolve a local destination against its page, enforcing the visible OKF bundle boundary.
 * return an error for broken destinations and include the document for Markdown targets.
 * @throws on unexpected filesystem errors such as permission failures.
 */
export async function resolveLink(docs, doc, target) {
  const hash = target.indexOf("#");
  const rawPath = (hash < 0 ? target : target.slice(0, hash)).split("?")[0];
  let decoded, fragment;
  try {
    decoded = decodeURIComponent(rawPath);
    fragment =
      docs.okf && hash >= 0 ? decodeURIComponent(target.slice(hash + 1)) : "";
  } catch {
    return { error: "has invalid URI encoding" };
  }
  let path = doc.path;
  if (decoded.startsWith("/") && docs.okf)
    path = resolve(docs.root, "." + decoded);
  else if (decoded) path = resolve(dirname(doc.path), decoded);
  if (docs.okf) {
    const error = bundlePathError(docs.root, path);
    if (error) return { error };
    if (decoded.split("/").some(hiddenEntry))
      return { error: "addresses a hidden bundle entry" };
  }
  try {
    const actual = await realpath(path);
    if (docs.okf) {
      const error = bundlePathError(docs.root, actual);
      if (error) return { error };
      path = actual;
    }
  } catch (error) {
    if (!["ENOENT", "ENOTDIR", "ELOOP"].includes(error.code)) throw error;
    return { error: "does not resolve" };
  }
  const page =
    docs.byPath.get(path) ??
    (docs.okf ? docs.byPath.get(join(path, "index.md")) : undefined);
  return { path, page, fragment };
}

function hiddenEntry(part) {
  return part.startsWith(".") && part !== "." && part !== "..";
}

/** return a diagnostic for paths outside the visible bundle, including resolved aliases. */
export function bundlePathError(root, path) {
  const diff = relative(root, path);
  if (diff === ".." || diff.startsWith(".." + sep) || isAbsolute(diff))
    return "leaves the bundle; use a source URL";
  if (diff.split(sep).some(hiddenEntry))
    return "addresses a hidden bundle entry";
}

/** run one documentation check and return its CLI status for success, findings or failure. */
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
