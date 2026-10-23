import MarkdownIt from "markdown-it";

const KEYWORDS = ["MUST NOT", "SHALL NOT", "SHOULD NOT", "NOT RECOMMENDED", "MUST", "REQUIRED", "SHALL", "SHOULD", "RECOMMENDED", "MAY", "OPTIONAL"];
const KEYWORD = new RegExp(`^(${KEYWORDS.join("|")})(?:(?:\\s|(?!\\p{Pc})\\p{P})+(.+)?|$)`, "u");
const KEYWORD_MENTION = new RegExp(`^(?:${KEYWORDS.join("|")})(?:(?:,\\s*(?:(?:and|or)\\s+)?|\\s+(?:and|or)\\s+)(?:${KEYWORDS.join("|")}))*\\s+(?:is|are|means|denotes)\\b`);
const ROUTING_KEYWORD = new RegExp(`(?<![\\p{L}\\p{N}_])(?:${KEYWORDS.join("|")})(?![\\p{L}\\p{N}_])`, "u");
const ROUTING_MENTION = new RegExp(`(?<![\\p{L}\\p{N}_])${KEYWORD_MENTION.source.slice(1)}`, "gu");
const LABEL = /^(Guidelines|(?:(?:Good\/Bad|Good|Bad|Single Prose|Snippet|Decision-language|Implementation-language|Failure|Anti-Pattern)\s+)?Examples?):(?:\s|$)/i;
const SMALL_WORDS = new Set("a an and as at but by for from in of on or the to with".split(" "));
const TITLE_TOKENS = new Map(Object.entries({ api: "API", cli: "CLI", json: "JSON", rfc: "RFC", ui: "UI", yaml: "YAML", next: "Next.js", tanstack: "TanStack" }));
const TRANSPARENT_HTML = new Set("a b del em i ins mark s small span strong sub sup u".split(" "));
const parser = new MarkdownIt({ html: true });

/** build block/container relationships from the already captured parser tokens. */
function blockTree(tokens) {
  const root = { children: [] };
  const stack = [root];
  for (const token of tokens) {
    if (token.nesting === -1) { stack.pop(); continue; }
    const node = { token, children: [] };
    stack.at(-1).children.push(node);
    if (token.nesting === 1) stack.push(node);
  }
  return root.children;
}

function inline(node) {
  return node.children.find(child => child.token.type === "inline")?.token.children ?? [];
}

function text(tokens) {
  return tokens.map(token => ["text", "code_inline"].includes(token.type) ? token.content : ["softbreak", "hardbreak"].includes(token.type) ? " " : token.type === "image" ? text(token.children ?? []) : "").join("");
}

function inlineRendered(tokens) {
  return Boolean(text(tokens).trim() || tokens.some(token => token.type === "image" || token.type === "html_inline" && /^<(?:img|svg)(?=[\s/>])/i.test(token.content)));
}

/** recognize bounded colon-bearing labels and retain their formatting separately. */
function label(node) {
  if (!["paragraph_open", "heading_open"].includes(node.token.type)) return null;
  const tokens = inline(node).filter(token => token.type !== "text" || token.content !== "");
  const first = tokens.find(token => !["strong_open", "strong_close", "em_open", "em_close", "link_open", "link_close", "html_inline"].includes(token.type));
  if (first?.type === "code_inline") return null;
  const match = text(tokens).match(LABEL);
  if (!match) return null;
  let remaining = match[1].length + 1;
  for (const token of tokens) {
    if (remaining <= 0) break;
    if (token.type === "image") return null;
    remaining -= text([token]).length;
  }
  const end = tokens.findIndex(token => token.type === "strong_close");
  const bold = node.token.type === "paragraph_open" && tokens[0]?.type === "strong_open" && text(tokens.slice(1, end)).trim() === match[1] + ":";
  const explanation = text(tokens).slice(match[0].trimEnd().length).trim();
  return {
    name: match[1].trim().replace(/\s+/g, " ").toLowerCase(),
    bold,
    explanation,
    demonstration: Boolean(explanation) || bold && inlineRendered(tokens.slice(end + 1)),
  };
}

/** a literal/quoted keyword is not an authored keyword opener. */
function keyword(node, { requireBody = false, excludeMentions = false, includeHeadings = false, anywhere = false } = {}) {
  let tokens;
  if (node?.token.type === "html_block") {
    const content = node.token.content.match(/^(?:\s*<!--[\s\S]*?-->)+\s*([\s\S]*)$/)?.[1].trim() ?? "";
    tokens = parser.parseInline(content, {})[0].children;
  } else {
    if (node?.token.type !== "paragraph_open" && !(includeHeadings && node?.token.type === "heading_open")) return false;
    tokens = inline(node);
  }
  const regions = [tokens];
  if (anywhere) for (const region of regions) for (const token of region) if (token.type === "image") regions.push(token.children ?? []);
  return regions.some(region => {
    region = region.filter(token => {
      if (["strong_open", "strong_close", "em_open", "em_close", "link_open", "link_close"].includes(token.type)) return false;
      if (token.type === "text") return token.content !== "";
      if (token.type !== "html_inline") return true;
      const tag = token.content.match(/^<\/?([a-z][a-z0-9]*)(?=[\s/>])/i)?.[1].toLowerCase();
      return !/^<!--[\s\S]*-->$/.test(token.content) && !TRANSPARENT_HTML.has(tag);
    });
    if (!anywhere && region[0]?.type !== "text") return false;
    let content = region.map(token => token.type === "text" ? token.content : " ").join("").trim();
    if (anywhere) {
      content = content.replace(/"[^"]*"|“[^”]*”|(?<![\p{L}\p{N}_])'[^']*'|‘[^’]*’/gu, " ").replace(ROUTING_MENTION, " ");
      return ROUTING_KEYWORD.test(content);
    }
    const match = content.match(KEYWORD);
    if (excludeMentions && KEYWORD_MENTION.test(content)) return false;
    return Boolean(match && (!requireBody || match[2] || region.some(token => token.type === "code_inline" && token.content.trim())));
  });
}

function list(node) { return ["bullet_list_open", "ordered_list_open"].includes(node.token.type); }
function invisible(node) { return ["html_block", "paragraph_open"].includes(node.token.type) && !rendered(node); }
function firstParagraph(item) { return item.children.find(node => !invisible(node)); }

/** find rendered content through parsed containers without counting comments. */
function rendered(node) {
  if (node.token.type === "inline") return inlineRendered(node.token.children ?? []);
  if (node.token.type === "html_block") return inlineRendered(parser.parseInline(node.token.content, {})[0].children);
  return node.children.length ? node.children.some(rendered) : Boolean(node.token.content?.trim());
}

/** retain rendered link labels alongside destinations for the recognition profiles. */
function links(node) {
  const tokens = inline(node);
  return tokens.flatMap((token, index) => {
    if (token.type !== "link_open") return [];
    const close = tokens.findIndex((candidate, i) => i > index && candidate.type === "link_close");
    return [{ href: token.attrGet("href"), label: text(tokens.slice(index + 1, close)) }];
  });
}

function routeCandidate(node, next) {
  if (node.token.type !== "paragraph_open") return false;
  const content = text(inline(node));
  const reference = links(node).find(link => /^(?:\.\/)?references\//.test(link.href));
  return reference && (/(?:for|when):\s*$/.test(content) || (content.startsWith(`See ${reference.label} `) && next && list(next)));
}

/**
 * interpret authored sections once; quotes/code remain demonstration/example leaves.
 * @throws when the captured parser tokens are unavailable or malformed
 */
export function analyzeBody(document) {
  const root = blockTree(document.tokens);
  const body = { root, labels: [], guidelines: [], ruleLists: [], routes: [], attached: [], groups: [] };
  /** keep section/list associations local to their authored container. */
  function visit(children, isRoot = false, attached = false) {
    let heading = null;
    let demonstration = false;
    let guidelines = null;
    let route = null;
    let group = null;
    for (let index = 0; index < children.length; index++) {
      const node = children[index];
      if (invisible(node)) continue;
      if (node.token.type === "heading_open") {
        heading = node;
        demonstration = false;
        guidelines = route = group = null;
      }
      const recognized = label(node);
      if (recognized) {
        body.labels.push({ node, ...recognized });
        group = null;
        guidelines = null;
        if (recognized.name === "guidelines") {
          const entry = { node, ...recognized, demonstration: demonstration || recognized.demonstration, attached: attached || Boolean(route), lists: [] };
          body.guidelines.push(entry);
          guidelines = entry;
          if (entry.attached) body.attached.push(node);
        } else {
          route = null;
          group = { node, ...recognized, blocks: [] };
          body.groups.push(group);
        }
        if (recognized.demonstration) demonstration = true;
        continue;
      }
      if (node.token.type === "heading_open") continue;
      if (isRoot && document.kind === "skill" && routeCandidate(node, children.slice(index + 1).find(next => !invisible(next)))) {
        route = { node, heading, lists: [], marker: null };
        body.routes.push(route);
        guidelines = group = null;
        continue;
      }
      if (list(node)) {
        if (route && route.marker !== null && route.marker !== node.token.markup) route = null;
        if (route) {
          route.marker = node.token.markup;
          route.lists.push(node);
        }
        if (guidelines) guidelines.lists.push(node);
        if (group) group.blocks.push(node);
        const inRoute = attached || Boolean(route);
        if (inRoute) {
          for (const item of node.children) for (const child of item.children) if (keyword(child, { includeHeadings: true, anywhere: true })) body.attached.push(child);
        } else if (isRoot && !guidelines && !group && node.children.some(item => keyword(firstParagraph(item), { requireBody: true, excludeMentions: true, includeHeadings: true }))) {
          body.ruleLists.push(node);
        }
        if (!group) for (const item of node.children) visit(item.children, false, inRoute);
        demonstration ||= rendered(node);
        continue;
      }
      if (node.token.type === "paragraph_open") {
        guidelines = route = null;
        if (group) group.blocks.push(node);
        demonstration ||= rendered(node);
        continue;
      }
      // an independent quote/fence is a boundary; a contained one is visited inside its list item.
      if (["blockquote_open", "fence", "code_block", "table_open", "html_block", "hr"].includes(node.token.type)) {
        route = null;
        if (node.token.type === "html_block") guidelines = null;
        if (group && node.token.type !== "hr") group.blocks.push(node);
        demonstration ||= rendered(node);
      }
    }
  }
  visit(root, true);
  return body;
}

function title(name) {
  const words = name.replace(/(^|-)end-to-end(?=-|$)/g, "$1End§to§End").replace(/(^|-)high-fidelity(?=-|$)/g, "$1High§Fidelity").split("-");
  return words.map((word, index) => word.includes("§") ? word.replaceAll("§", "-") : TITLE_TOKENS.get(word) ?? (index > 0 && index < words.length - 1 && SMALL_WORDS.has(word) ? word : word[0].toUpperCase() + word.slice(1))).join(" ");
}

/** recognize only the normalized full/compact RFC interpretation templates. */
function declaration(node) {
  if (node.token.type !== "paragraph_open") return false;
  const tokens = inline(node);
  if (tokens.some(token => !["text", "softbreak", "hardbreak", "strong_open", "strong_close", "em_open", "em_close", "link_open", "link_close"].includes(token.type))) return false;
  const content = text(tokens).replace(/\s+/g, " ").trim();
  const match = content.match(/^The (RFC 2119 keywords|key words (.+)) in this document are to be interpreted as described in RFC 2119\.$/);
  if (!match) return false;
  const link = links(node);
  if (link.length !== 1 || link[0].label.replace(/\s+/g, " ").trim() !== "RFC 2119" || !/^https?:\/\/(?:www\.rfc-editor\.org\/rfc\/rfc2119(?:\.html)?|datatracker\.ietf\.org\/doc\/html\/rfc2119)\/?$/.test(link[0].href)) return false;
  if (text(tokens.slice(tokens.findIndex(token => token.type === "link_close") + 1)).trim() !== ".") return false;
  if (!match[2]) return true;
  const terms = [...match[2].matchAll(/"([^"]+)"|“([^”]+)”/g)].map(term => term[1] ?? term[2]);
  const quoted = '(?:"[^"]+"|“[^”]+”)';
  const serialized = new RegExp(`^${quoted}(?:,\\s*${quoted})*(?:,?\\s+and\\s+${quoted})?$`);
  return serialized.test(match[2]) && new Set(terms).size === terms.length && KEYWORDS.filter(word => word !== "NOT RECOMMENDED").every(word => terms.includes(word)) && terms.every(word => KEYWORDS.includes(word));
}

/** check format contracts, not semantic sufficiency or a complete epic audit. */
export const bodyChecks = {
  AS002(body, report, options, name) {
    if (!name) return;
    const heading = body.root.find(node => node.token.type === "heading_open" && node.token.tag === "h1");
    const expected = title(name);
    const tokens = heading ? inline(heading) : [];
    if (!heading || text(tokens).trim() !== expected || tokens.some(token => !["text", "strong_open", "strong_close", "em_open", "em_close", "softbreak", "hardbreak"].includes(token.type))) report(heading, `Expected root H1 title: ${expected}`);
  },
  /** declaration count/position applies only when the parent authors normative lists. */
  AS003(body, report) {
    if (!body.ruleLists.length && !body.guidelines.some(entry => !entry.attached && entry.lists.some(rendered))) return;
    const declarations = body.root.filter(declaration);
    const firstH2 = body.root.findIndex(node => node.token.type === "heading_open" && node.token.tag === "h2");
    const firstRules = body.root.findIndex(node => body.ruleLists.includes(node) || body.labels.some(entry => entry.node === node));
    const end = firstH2 !== -1 ? firstH2 : firstRules !== -1 ? firstRules : body.root.length;
    const introduction = body.root.slice(0, end).filter(node => ["paragraph_open", "html_block"].includes(node.token.type) && !invisible(node));
    if (declarations.length !== 1 || declarations[0] !== introduction.at(-1)) report(declarations[1] ?? declarations[0] ?? body.root[end], "Require exactly one recognized RFC 2119 declaration as the final introductory paragraph");
  },
  AS004(body, report) {
    for (const entry of body.labels) if (!entry.bold) report(entry.node, "Recognized colon-bearing labels must be bold paragraphs");
  },
  AS005(body, report) {
    for (const entry of body.guidelines) {
      if (entry.attached) continue;
      for (const node of entry.lists) for (const item of node.children) if (!keyword(firstParagraph(item), { includeHeadings: true })) report(item, "Main Guidelines items must begin with an uppercase RFC 2119 keyword");
    }
  },
  AS006(body, report, options) {
    for (const entry of body.guidelines) if (entry.bold && !entry.attached && !entry.demonstration) report(entry.node, "Guidelines require an earlier rendered demonstration in their own section");
    if (options.auditMissingGuidelines === true) for (const node of body.ruleLists) report(node, "Authored RFC-keyword list lacks a Guidelines label (opt-in audit)");
  },
  /** validate route serialization without resolving the reference destination. */
  AS007(body, report) {
    for (const route of body.routes) {
      const tokens = inline(route.node);
      const content = text(tokens);
      const link = links(route.node);
      const target = link[0]?.href.split("#")[0];
      const topic = route.heading && route.heading.token.tag !== "h1";
      const reference = link.length === 1 && /^\.\/references\/[^/]+\.md$/.test(target) && link[0].label === target.split("/").at(-1);
      const prefix = `See ${link[0]?.label} `;
      const leadIn = content.startsWith(prefix) && /^(?:for|when):$/.test(content.slice(prefix.length)) && tokens.every(token => token.type !== "image" && (token.type !== "html_inline" || /^<!--[\s\S]*-->$/.test(token.content)));
      const descriptiveList = route.lists.length && route.lists.every(node => node.token.type === "bullet_list_open" && node.children.some(item => item.children.some(child => ["paragraph_open", "heading_open"].includes(child.token.type) && inlineRendered(inline(child)))));
      if (!topic || !reference || !leadIn || !descriptiveList) report(route.node, "Reference routes require a topic heading, See filename-labelled ./references/ link, for:/when: lead-in and a nonempty unordered list");
    }
  },
  AS008(body, report) {
    for (const node of new Set(body.attached)) report(node, "Reference routing must not contain normative guidance or an attached Guidelines label");
  },
  AS009(body, report) {
    for (const group of body.groups) {
      if (!/^(?:good|bad|good\/bad) examples?$/.test(group.name) || group.blocks.length < 2) continue;
      if (!group.name.endsWith("examples") || group.blocks.some(node => node.token.type !== "blockquote_open")) report(group.node, "Multiple Good/Bad examples require a plural label and one blockquote per example (AS004 owns bold formatting)");
    }
  },
};
