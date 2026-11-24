import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import { parseFragment } from "parse5";
import { parseDocument, isAlias, isMap, LineCounter } from "yaml";

const markdown = new MarkdownIt({ html: true }).use(footnote);
const external = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

// OKF §6.2 defines these fields independently of a project's type vocabulary.
// Keep their paths distinct from index entries and from links in Markdown.
function readPathFields(meta, syntax, lineCounter) {
  const links = [];
  function add(keys, target) {
    if (typeof target !== "string" || !target || external.test(target)) return;
    // §5.1 also permits a human-readable population descriptor here.
    // Spaces in a URI reference must be percent-encoded.
    if (keys[0] === "sources" && /\s/.test(target)) return;
    // Report the field's use site, including an alias of an entire source list.
    let node = syntax;
    for (const key of keys) {
      if (isAlias(node)) break;
      const child = node.get?.(key, true);
      if (!child) break;
      node = child;
    }
    const line = 1 + lineCounter.linePos(node.range[0]).line;
    links.push({ target, line, field: keys.join(".") });
  }
  for (const key of ["resource", "computation", "superseded_by"])
    add([key], meta.get(key));
  for (const key of ["executor", "attester"])
    add([key, "resource"], meta.get(key)?.get?.("resource"));
  const sources = meta.get("sources");
  if (Array.isArray(sources)) {
    sources.forEach((source, i) =>
      add(["sources", i, "resource"], source?.get?.("resource")),
    );
  } else if (sources instanceof Map) {
    add(["sources", "resource"], sources.get("resource"));
  }
  return links;
}

export function readMarkdown(text) {
  // Parse the header separately so Markdown line numbers include the frontmatter.
  const header = text.match(/^---\r?\n([\s\S]*?)^---\r?$(?:\n|$)/m);
  let meta, metadataError;
  let links = [];
  const lineCounter = new LineCounter();
  let body = text;
  if (header?.index === 0) {
    const yaml = parseDocument(header[1], { schema: "core", lineCounter });
    metadataError = yaml.errors[0]?.message ?? yaml.warnings[0]?.message;
    if (!isMap(yaml.contents))
      metadataError ??= "frontmatter must be a mapping";
    if (isMap(yaml.contents) && !metadataError) {
      try {
        meta = yaml.toJS({ mapAsMap: true, maxAliasCount: 100 });
        if (meta.has("type"))
          links = readPathFields(meta, yaml.contents, lineCounter);
      } catch (error) {
        metadataError = error.message;
      }
    }
    body = text.slice(header[0].length);
  } else if (/^---[ \t]*\r?\n/.test(text)) {
    metadataError = "frontmatter requires exact --- opening and closing lines";
  }
  const offset =
    text.slice(0, text.length - body.length).split("\n").length - 1;
  const env = {};
  const tokens = markdown.parse(body, env);
  const headings = [],
    anchors = new Set();
  let hasHtml = false;
  for (const [i, token] of tokens.entries()) {
    if (token.type === "heading_open") {
      const label = tokens[i + 1].children
        .filter((t) =>
          ["text", "code_inline", "image", "softbreak"].includes(t.type),
        )
        .map((t) => (t.type === "softbreak" ? " " : t.content))
        .join("");
      headings.push({ level: Number(token.tag.slice(1)), text: label });
      // GitHub-style heading IDs preserve underscores, hyphens and Unicode letters.
      const base = label
        .toLowerCase()
        .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
        .replace(/ /g, "-");
      let anchor = base,
        suffix = 0;
      while (anchors.has(anchor)) anchor = base + "-" + ++suffix;
      anchors.add(anchor);
    }
    let line = offset + (token.map?.[0] ?? 0) + 1;
    for (const child of token.children ?? [token]) {
      if (child.type === "link_open" || child.type === "image") {
        const target = child.attrGet(child.type === "image" ? "src" : "href");
        if (!external.test(target))
          links.push({ target, line, image: child.type === "image" });
      } else if (child.type === "softbreak" || child.type === "hardbreak") {
        line++;
      } else if (child.type === "html_inline" || child.type === "html_block") {
        hasHtml = true;
      }
    }
  }
  if (hasHtml) {
    // Parse rendered HTML as a single fragment: raw-text and comment boundaries
    // may span multiple Markdown tokens. Template contents are inert.
    const html = markdown.renderer.render(tokens, markdown.options, env);
    const pending = [parseFragment(html)];
    while (pending.length) {
      const element = pending.pop();
      for (const attr of element.attrs ?? []) {
        if (
          attr.name === "id" ||
          (element.tagName === "a" && attr.name === "name")
        )
          anchors.add(attr.value);
      }
      for (const child of element.childNodes ?? []) pending.push(child);
    }
  }
  return {
    meta,
    metadataError,
    links,
    anchors,
    headings,
  };
}
