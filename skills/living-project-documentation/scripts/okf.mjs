import MarkdownIt from "markdown-it";
import { parseDocument, isMap } from "yaml";

const markdown = new MarkdownIt({ html: true });
export function readMarkdown(text) {
  // Preserve original line numbers while excluding metadata from the link graph.
  const header = text.match(/^---[ \t]*\r?\n([\s\S]*?)^---[ \t]*\r?$(?:\n|$)/m);
  let meta, metadataError;
  let body = text;
  if (header?.index === 0) {
    const yaml = parseDocument(header[1], { schema: "core" });
    metadataError = yaml.errors[0]?.message ?? yaml.warnings[0]?.message;
    if (!isMap(yaml.contents))
      metadataError ??= "frontmatter must be a mapping";
    meta = yaml.contents;
    body = text.slice(header[0].length);
  } else if (/^---[ \t]*\r?\n/.test(text)) {
    metadataError = "frontmatter is missing its closing delimiter";
  }
  const offset =
    text.slice(0, text.length - body.length).split("\n").length - 1;
  const tokens = markdown.parse(body, {});
  const headings = [],
    links = [],
    anchors = new Set();
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
        if (!/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target))
          links.push({ target, line, image: child.type === "image" });
      } else if (child.type === "softbreak" || child.type === "hardbreak") {
        line++;
      } else if (child.type === "html_inline" || child.type === "html_block") {
        for (const match of child.content.matchAll(
          /<[\w-]+\b[^>]*?\s(?:id|name)\s*=\s*(?:"([^"]+)"|'([^']+)')/gi,
        ))
          anchors.add(match[1] ?? match[2]);
      }
    }
  }
  return {
    meta: isMap(meta) ? meta : undefined,
    metadataError,
    links,
    anchors,
    headings,
  };
}
