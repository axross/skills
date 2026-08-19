#!/usr/bin/env node
// an outcome-phase script judgment, and the discriminating factor of this
// scenario: does the added wireframe document actually stay at breadboard
// fidelity — greys plus at most a small, reserved set of cue colours —
// rather than drifting into a real, brand-coloured mockup. This is exactly
// what skills/wireframe-design/scripts/check-wireframe.mjs states it cannot
// see ("it cannot see hierarchy, grouping, or grayscale discipline"), so
// this scenario carries its own reading of it instead.
//
// wireframe-design's own SKILL.md, "Breadboard Primitives": "keep the whole
// page at breadboard fidelity: greys, dashed inputs, solid buttons, danger
// tint — never brand color … final typography, or final copy."
//
// The check, over every colour value declared in the added document's own
// CSS (its <style> block(s) and any style="..." attributes — the places a
// document actually DECLARES colour, as distinct from its visible prose,
// which is why the scan is scoped there and not to the whole file):
// convert each hex, rgb()/rgba(), hsl()/hsla(), and CSS named colour to
// HSL, and require. None of the four is read inside a quoted string's own
// CONTENTS — a `content:` value, a quoted `font-family` name — where a
// design annotation or placeholder copy can carry text shaped exactly like
// a declared colour without being one; see blankQuotedStringContents's own
// header. The one exception: a colour rendered through a url() payload — a
// data URI's own embedded SVG fill, quoted or not — DOES count, since it
// paints pixels on the page rather than being read as text; see
// findUrlCallEnd's own header for how a payload's own quote characters
// (paired or not — an SVG `<text>Author's posts</text>` is a natural,
// unpaired one) are kept from being misread as CSS-level delimiters
// either way.
//
// cssDeclarationText reads STRUCTURALLY, not as one bag of text: it yields
// only the VALUE side of each "property: value" declaration inside a
// <style> block's rule bodies, and each style="..." attribute's own
// declaration values — never a selector, a class name, an at-rule prelude,
// or a property name. A class named ".indigo-panel" or ".plum-tag" is a
// selector, not a value, and never reaches the colour scan below; neither
// does a comment (comments are stripped from a <style> block's content
// first, string-aware, before any declaration is read), so a colour
// function's name mentioned only in a comment can never trigger the
// refusal path either. See declarationValuesIn's own header for how. Nor
// does a custom-property NAME inside a var(...) reference: `--icon-red`
// and `--brand-blue` are ordinary naming, so var()'s own name token is
// blanked before the colour scan runs — see blankVarPropertyNames's own
// header for why the reference's optional fallback is deliberately left
// untouched instead.
//   - at least THREE distinct achromatic values (saturation <= 20%) — a
//     grey-box drawing needs several greys, so an unstyled HTML outline
//     with zero or one grey is not one; and
//   - at most THREE distinct chromatic hue families (saturation > 20%,
//     binned into 30°-wide hue buckets) — the accent, danger, and
//     annotation cues the breadboard primitives are allowed to carry, and
//     nothing else.
// 20% is not a guess: wireframe-design's own kit
// (assets/wireframe-kit.html) declares its breadboard grey --wire-fill as
// #e7e8ec, which is 11.6% saturated, against its accent --accent
// #0588f0 at 95.9% saturated — this threshold's own vocabulary and
// numbers are carried here rather than read from that file at runtime
// (no judgment script in this repository may read a path under skills/).
// Binning hue into 30° buckets is what makes "one hue declared once for
// light mode and again for dark" count once: the kit's own light accent
// (H≈207°) and dark accent (H≈210°) fall in the same bucket.
//
// Multiple added HTML files are tolerated: this factor passes if AT LEAST
// ONE satisfies both thresholds. No added HTML document at all is a real,
// judgeable false (there is nothing to have kept at low fidelity); the diff
// naming an added HTML file the reconstructed workspace does not actually
// contain is a judgment this script cannot make, so THAT exits non-zero.
//
// What this script classifies, and what it refuses to judge: hex,
// rgb()/rgba(), hsl()/hsla(), and CSS named colours are converted to HSL
// and counted as above. `color-mix()`'s own OPERANDS are scanned as
// ordinary value text alongside those — not blended, not resolved — see
// UNSUPPORTED_COLOR_FUNCTIONS's own header for why that is the right
// reading for this factor rather than a refusal. `oklch()`, `lch()`,
// `lab()`, and `hwb()` are NOT converted or classified — their channels
// are not directly comparable to the HSL saturation this factor's
// thresholds were measured against, and inventing an unverifiable chroma
// threshold for them would be a worse defect than the silent under-count
// it would replace. If any added HTML candidate's own CSS invokes one of
// those FOUR functions, this script exits non-zero naming the function and
// the file, exactly as it already does for a workspace it cannot read —
// never a guessed true or false for a page whose colours it could not
// actually classify.
//
// usage: node check-low-fidelity-palette.mjs <context.json>

import { readFileSync } from "node:fs";
import { readAddedHtmlFiles } from "./lib/added-files.mjs";

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

const contextPath = process.argv[2];
if (!contextPath) fail("usage: check-low-fidelity-palette.mjs <context.json>");

let context;
try {
  context = JSON.parse(readFileSync(contextPath, "utf8"));
} catch (error) {
  fail(`could not read or parse ${contextPath}: ${error.message}`);
}

const diff = context.material?.diff;
if (typeof diff !== "string") {
  fail("context.material.diff must be a string — this script judges the outcome phase alone.");
}

const ACHROMATIC_SATURATION_MAX = 20; // percent
const MIN_ACHROMATIC_VALUES = 3;
const MAX_CHROMATIC_HUE_FAMILIES = 3;
const HUE_BIN_WIDTH = 30; // degrees

/**
 * the CSS Color Module's standard extended named-colour keywords, mapped to
 * their hex value. "transparent" is deliberately absent: it carries no hue
 * or chroma to classify.
 */
const NAMED_COLORS = {
  aliceblue: "#f0f8ff",
  antiquewhite: "#faebd7",
  aqua: "#00ffff",
  aquamarine: "#7fffd4",
  azure: "#f0ffff",
  beige: "#f5f5dc",
  bisque: "#ffe4c4",
  black: "#000000",
  blanchedalmond: "#ffebcd",
  blue: "#0000ff",
  blueviolet: "#8a2be2",
  brown: "#a52a2a",
  burlywood: "#deb887",
  cadetblue: "#5f9ea0",
  chartreuse: "#7fff00",
  chocolate: "#d2691e",
  coral: "#ff7f50",
  cornflowerblue: "#6495ed",
  cornsilk: "#fff8dc",
  crimson: "#dc143c",
  cyan: "#00ffff",
  darkblue: "#00008b",
  darkcyan: "#008b8b",
  darkgoldenrod: "#b8860b",
  darkgray: "#a9a9a9",
  darkgreen: "#006400",
  darkgrey: "#a9a9a9",
  darkkhaki: "#bdb76b",
  darkmagenta: "#8b008b",
  darkolivegreen: "#556b2f",
  darkorange: "#ff8c00",
  darkorchid: "#9932cc",
  darkred: "#8b0000",
  darksalmon: "#e9967a",
  darkseagreen: "#8fbc8f",
  darkslateblue: "#483d8b",
  darkslategray: "#2f4f4f",
  darkslategrey: "#2f4f4f",
  darkturquoise: "#00ced1",
  darkviolet: "#9400d3",
  deeppink: "#ff1493",
  deepskyblue: "#00bfff",
  dimgray: "#696969",
  dimgrey: "#696969",
  dodgerblue: "#1e90ff",
  firebrick: "#b22222",
  floralwhite: "#fffaf0",
  forestgreen: "#228b22",
  fuchsia: "#ff00ff",
  gainsboro: "#dcdcdc",
  ghostwhite: "#f8f8ff",
  gold: "#ffd700",
  goldenrod: "#daa520",
  gray: "#808080",
  grey: "#808080",
  green: "#008000",
  greenyellow: "#adff2f",
  honeydew: "#f0fff0",
  hotpink: "#ff69b4",
  indianred: "#cd5c5c",
  indigo: "#4b0082",
  ivory: "#fffff0",
  khaki: "#f0e68c",
  lavender: "#e6e6fa",
  lavenderblush: "#fff0f5",
  lawngreen: "#7cfc00",
  lemonchiffon: "#fffacd",
  lightblue: "#add8e6",
  lightcoral: "#f08080",
  lightcyan: "#e0ffff",
  lightgoldenrodyellow: "#fafad2",
  lightgray: "#d3d3d3",
  lightgreen: "#90ee90",
  lightgrey: "#d3d3d3",
  lightpink: "#ffb6c1",
  lightsalmon: "#ffa07a",
  lightseagreen: "#20b2aa",
  lightskyblue: "#87cefa",
  lightslategray: "#778899",
  lightslategrey: "#778899",
  lightsteelblue: "#b0c4de",
  lightyellow: "#ffffe0",
  lime: "#00ff00",
  limegreen: "#32cd32",
  linen: "#faf0e6",
  magenta: "#ff00ff",
  maroon: "#800000",
  mediumaquamarine: "#66cdaa",
  mediumblue: "#0000cd",
  mediumorchid: "#ba55d3",
  mediumpurple: "#9370db",
  mediumseagreen: "#3cb371",
  mediumslateblue: "#7b68ee",
  mediumspringgreen: "#00fa9a",
  mediumturquoise: "#48d1cc",
  mediumvioletred: "#c71585",
  midnightblue: "#191970",
  mintcream: "#f5fffa",
  mistyrose: "#ffe4e1",
  moccasin: "#ffe4b5",
  navajowhite: "#ffdead",
  navy: "#000080",
  oldlace: "#fdf5e6",
  olive: "#808000",
  olivedrab: "#6b8e23",
  orange: "#ffa500",
  orangered: "#ff4500",
  orchid: "#da70d6",
  palegoldenrod: "#eee8aa",
  palegreen: "#98fb98",
  paleturquoise: "#afeeee",
  palevioletred: "#db7093",
  papayawhip: "#ffefd5",
  peachpuff: "#ffdab9",
  peru: "#cd853f",
  pink: "#ffc0cb",
  plum: "#dda0dd",
  powderblue: "#b0e0e6",
  purple: "#800080",
  rebeccapurple: "#663399",
  red: "#ff0000",
  rosybrown: "#bc8f8f",
  royalblue: "#4169e1",
  saddlebrown: "#8b4513",
  salmon: "#fa8072",
  sandybrown: "#f4a460",
  seagreen: "#2e8b57",
  seashell: "#fff5ee",
  sienna: "#a0522d",
  silver: "#c0c0c0",
  skyblue: "#87ceeb",
  slateblue: "#6a5acd",
  slategray: "#708090",
  slategrey: "#708090",
  snow: "#fffafa",
  springgreen: "#00ff7f",
  steelblue: "#4682b4",
  tan: "#d2b48c",
  teal: "#008080",
  thistle: "#d8bfd8",
  tomato: "#ff6347",
  turquoise: "#40e0d0",
  violet: "#ee82ee",
  wheat: "#f5deb3",
  white: "#ffffff",
  whitesmoke: "#f5f5f5",
  yellow: "#ffff00",
  yellowgreen: "#9acd32",
};

const NAMED_COLOR_RE = new RegExp(`\\b(${Object.keys(NAMED_COLORS).join("|")})\\b`, "gi");

/** @param {number} r 0-255 @param {number} g 0-255 @param {number} b 0-255 */
function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

/** @param {number} h degrees, any range @param {number} s percent @param {number} l percent */
function hslToRgb(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = s / 100;
  const ll = l / 100;
  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;
  let r1, g1, b1;
  if (hh < 60) [r1, g1, b1] = [c, x, 0];
  else if (hh < 120) [r1, g1, b1] = [x, c, 0];
  else if (hh < 180) [r1, g1, b1] = [0, c, x];
  else if (hh < 240) [r1, g1, b1] = [0, x, c];
  else if (hh < 300) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

/** @param {string} hex without the leading "#" @returns {{r:number,g:number,b:number}|null} */
function hexToRgb(hex) {
  if (hex.length === 3 || hex.length === 4) {
    const [r, g, b] = hex.slice(0, 3).split("");
    return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16) };
  }
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
    };
  }
  return null;
}

/**
 * a CSS angle token as degrees, honouring deg/grad/rad/turn and treating a
 * bare number as degrees.
 * @param {string} token
 * @returns {number} degrees, or NaN when the token is not an angle at all
 */
function parseAngle(token) {
  const match = token.trim().match(/^(-?[\d.]+)(deg|grad|rad|turn)?$/i);
  if (!match) return NaN;
  const value = parseFloat(match[1]);
  const unit = (match[2] || "deg").toLowerCase();
  if (unit === "grad") return value * 0.9;
  if (unit === "rad") return (value * 180) / Math.PI;
  if (unit === "turn") return value * 360;
  return value;
}

function parsePercent(token) {
  const match = token.trim().match(/^(-?[\d.]+)%?$/);
  return match ? parseFloat(match[1]) : NaN;
}

/**
 * strips `//`-shaped and `/* *\/` comment spans from `text`, leaving every
 * other character — including one inside a single-, double-, or
 * backtick-quoted string, which is walked over untouched (escapes
 * respected) since comment syntax has no special meaning inside a string.
 * A `/* *\/` comment's own newlines are kept as newlines. CSS has no `//`
 * line comment of its own, but this also runs over a `<style>` block's raw
 * text before any HTML/CSS-specific reading, so stripping it too costs
 * nothing and catches a stray one without having to special-case CSS's own
 * comment grammar.
 * @param {string} text
 * @returns {string}
 */
function stripComments(text) {
  let out = "";
  let quote = null;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      out += ch;
      if (ch === "\\" && i + 1 < text.length) {
        out += text[i + 1];
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      i++;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }
    if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        out += text[i] === "\n" ? "\n" : " ";
        i++;
      }
      i += 2;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * every VALUE side of a "property: value" declaration in `cssText`, read
 * structurally rather than as one bag of text: `cssText` is split on `{`,
 * `}`, and `;` the way a plain (non-preprocessor) stylesheet's own grammar
 * does, and a segment is treated as a declaration only when it matches
 * "property: value" AND does not itself end in `{` — a segment ending in
 * `{` is a selector or an at-rule prelude (".indigo-panel {",
 * "@media (prefers-color-scheme: dark) {"), never a declaration, however
 * colour-word-shaped its own text is. A `style="..."` attribute has no
 * braces at all, so every segment there is delimited by `;` alone, plus
 * one trailing segment with no closing delimiter — both are handled by
 * the same scan. This is the same declaration-recognition shape
 * check-css-property-group-order.mjs and check-css-syntax.mjs already use
 * elsewhere in this repository, not a full CSS parser: it does not
 * validate that a value is well-formed CSS on its own terms, only that
 * the text before a delimiter reads as "ident: value".
 *
 * The scan is quote-, paren-depth-, AND url()-aware: a `{`, `}`, or `;`
 * encountered inside a `'…'`/`"…"`/`` `…` `` span, inside any `(…)`, or
 * inside a `url(...)` call's own payload, is never treated as a
 * delimiter. A quoted value can itself carry a `;` — a `data:` URI's own
 * MIME marker (`url("data:image/svg+xml;utf8,…")`) is exactly that shape,
 * and without quote-awareness the `;` inside it splits one declaration
 * into two fragments, neither of which reads as "ident: value" any more,
 * so the fragment carrying the actual colour is silently dropped from
 * `values` rather than misclassified — a real fidelity violation (a
 * colour smuggled past the achromatic/hue-family count) then passes as
 * compliant. The same `data:` URI written WITHOUT quotes
 * (`url(data:image/svg+xml;utf8,…)`, which CSS's own url-token grammar
 * permits) carries the identical `;` with no quote to protect it at all,
 * which is why parens are tracked independently rather than relying on
 * quote-awareness alone: any `;` while paren-depth is above zero is
 * inert, quoted or not, until the matching `)` returns depth to zero.
 *
 * A url() call gets a THIRD kind of awareness, on top of both: its own
 * span — from "url(" through the matching ")", found with the same
 * isUrlCallStart / findUrlCallEnd this file's own blankQuotedStringContents
 * already uses for the identical reason — is consumed as one atomic unit
 * BEFORE the character-by-character quote check ever runs on it. Without
 * this, an apostrophe inside an unquoted url() payload (an SVG
 * `<text>Author's posts</text>`, the natural way to get one on this very
 * subject) is read as opening a single-quoted string, since the bare
 * quote-detection below has no notion of "already inside a url() call"
 * and triggers on ANY unescaped quote character regardless of paren
 * depth. That single stray quote then desyncs quote state for the rest of
 * the stylesheet: nothing after it is ever recognised as a real `;`/`{`/
 * `}` delimiter until some later, unrelated quote happens to close it, so
 * selector text downstream gets folded into what this function treats as
 * a declaration value — exactly the failure this function's own header
 * (see cssDeclarationText) promises never happens to a class name.
 * Consuming the whole span atomically means the quote(s) inside a url()
 * payload are never seen by the outer scan at all, so they cannot open or
 * close anything out here.
 * @param {string} cssText
 * @returns {string[]}
 */
function declarationValuesIn(cssText) {
  const values = [];
  const consider = (segment) => {
    const trimmed = segment.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^(--[A-Za-z0-9-]+|[A-Za-z-]+)\s*:\s*([\s\S]+)$/);
    if (match) values.push(match[2]);
  };
  let segStart = 0;
  let quote = null;
  let parenDepth = 0;
  for (let i = 0; i < cssText.length; i++) {
    const ch = cssText[i];
    if (quote) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) quote = null;
      continue;
    }
    if (isUrlCallStart(cssText, i)) {
      i = findUrlCallEnd(cssText, i + 4) - 1; // -1: this loop's own i++ lands just past it
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(") {
      parenDepth++;
      continue;
    }
    if (ch === ")") {
      parenDepth = Math.max(0, parenDepth - 1);
      continue;
    }
    if (parenDepth > 0) continue; // inside a function call — its own "{"/"}"/";" are not delimiters here
    if (ch !== "{" && ch !== "}" && ch !== ";") continue;
    const segment = cssText.slice(segStart, i);
    if (ch !== "{") consider(segment); // "{" starts a selector/prelude segment, never a declaration
    segStart = i + 1;
  }
  consider(cssText.slice(segStart)); // a trailing declaration with no closing ";" (a style="" attribute's last pair)
  return values;
}

/**
 * extracts the text a document actually DECLARES colour in: the VALUE side
 * of every declaration inside every <style>...</style> block, and every
 * style="..." attribute's own declaration values — comments stripped
 * first, string-aware (see stripComments), from BOTH sources alike, not
 * just the <style> block: an earlier version left a style="..."
 * attribute's own text unstripped, so a CSS comment inside one —
 * `style="background: /* was gold, now matches the accent token *\/
 * #0588f0;"` — could still smuggle a colour word past this function. A
 * selector, a class name, an at-rule prelude, and a property name are
 * never declaration VALUES either and are excluded structurally (see
 * declarationValuesIn) — so a class named ".indigo-panel" or ".plum-tag"
 * can never reach the colour scan below. Colour words appearing only in
 * visible prose (a heading, a label) are excluded for the same underlying
 * reason: they are not inside a <style> block or a style="..." attribute
 * at all.
 * @param {string} html
 * @returns {string}
 */
function cssDeclarationText(html) {
  const parts = [];
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
    parts.push(...declarationValuesIn(stripComments(m[1])));
  }
  for (const m of html.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)) {
    parts.push(...declarationValuesIn(stripComments(m[1])));
  }
  for (const m of html.matchAll(/\bstyle\s*=\s*'([^']*)'/gi)) {
    parts.push(...declarationValuesIn(stripComments(m[1])));
  }
  return parts.join("\n");
}

/**
 * true when `text[i]` starts a `url(` function call — "url" immediately
 * followed by "(", case-insensitively, and not itself the tail of a longer
 * identifier (a value that merely contains the letters, or a name like
 * "my-url", never opens a span). Matches CSS's own url-token grammar
 * closely enough for this factor's purpose: a bare identifier boundary
 * check, not a full tokenizer.
 * @param {string} text
 * @param {number} i
 * @returns {boolean}
 */
function isUrlCallStart(text, i) {
  if (text.slice(i, i + 4).toLowerCase() !== "url(") return false;
  const before = text[i - 1];
  return before === undefined || !/[\w$]/.test(before);
}

/**
 * the index just past the closing ")" of a url(...) call, given `start` —
 * the index right after the opening "(". `start` is first checked for a
 * single leading quote character: a `url("data:...")` payload is wrapped
 * in exactly ONE such quote, which owns everything up to its own matching
 * close (escapes respected) regardless of what that span contains —
 * including a nested, unrelated quote character, such as the single-
 * quoted attribute values a data URI's own embedded SVG markup carries
 * (`fill='#3355ff'`), which is never itself tracked as a delimiter once
 * inside the OUTER quote. An UNQUOTED payload — `url(data:...)` with no
 * wrapping quote at all — gets no quote-tracking of its own either: this
 * factor does not try to tell a genuine attribute-delimiting quote apart
 * from an ordinary apostrophe appearing as SVG prose text (an
 * `<text>Author's posts</text>` is exactly this shape), which a naive
 * per-character quote toggle cannot do without deeper parsing, so it does
 * not attempt to; it scans straight to the first unescaped ")" instead,
 * matching how an unquoted url-token's own CSS grammar treats an
 * unexpected quote inside it (as an ordinary byte, not a delimiter) once
 * a call is already malformed enough to need this recovery at all. Only
 * ONE quote character — the outer wrapper, if the payload has one at all
 * — is ever tracked; nothing nested inside it, quoted or not, is. Falls
 * back to the end of `text` if the call is never closed.
 * @param {string} text
 * @param {number} start index right after the opening "("
 * @returns {number}
 */
function findUrlCallEnd(text, start) {
  let i = start;
  const wrapQuote = text[i] === '"' || text[i] === "'" ? text[i] : null;
  if (wrapQuote) {
    i++; // past the opening wrapper quote
    while (i < text.length) {
      const ch = text[i];
      if (ch === "\\" && i + 1 < text.length) {
        i += 2;
        continue;
      }
      if (ch === wrapQuote) {
        i++;
        break;
      }
      i++;
    }
  }
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      i += 2;
      continue;
    }
    if (ch === ")") return i + 1;
    i++;
  }
  return text.length;
}

/**
 * blanks the encoded bytes of a base64 `data:` payload within one url()
 * span, length-preserving, leaving every other character in place.
 *
 * A url() payload is otherwise left whole deliberately — see
 * blankQuotedStringContents's own header: a data URI's embedded SVG really
 * does paint pixels, so a colour declared inside it is a declared colour.
 * Base64 is the exception, because it is opaque bytes rather than text. A
 * colour word matched inside an encoded blob is an artefact of the
 * encoding, not something the page renders, and base64's own `+`, `/` and
 * `=` characters supply the word boundaries that make such a match likely
 * in a long enough payload — enough to push a sketch that declared no
 * fourth hue over this factor's own ceiling. A payload that is not base64,
 * such as `data:image/svg+xml,` or `;utf8,` markup, keeps being read.
 * @param {string} urlSpan
 * @returns {string}
 */
function blankBase64Payload(urlSpan) {
  return urlSpan.replace(/(;base64,)([^)"']*)/i, (whole, marker, encoded) => marker + " ".repeat(encoded.length));
}

/**
 * blanks the CONTENTS of every quoted string in `text` (single-, double-,
 * or backtick-quoted; escapes respected), keeping the quote characters and
 * every other character in place, so the result is safe to scan for a
 * declared colour without ordinary quoted prose being misread as one —
 * `content: "No drafts yet — Coral Bay import pending"` reading the named
 * colour coral, or `content: "Design note: swap accent for #ff00aa"`
 * reading that hex literal, are the same defect: a design annotation
 * written as a document's own visible text is not a declared colour
 * whichever colour syntax it happens to use. All four colour matchers —
 * hex, rgb()/rgba(), hsl()/hsla(), and named — run against this function's
 * output, not the raw text.
 *
 * The one exception: a `url(...)` call's own payload is left completely
 * untouched, quoted or not (see isUrlCallStart / findUrlCallEnd) — not
 * because it escapes the quote rule, but because it is not the same KIND
 * of string. Every other quoted value in CSS is TEXT: a reader sees its
 * characters, and nothing renders them. A url() payload is a RESOURCE: a
 * data URI's own embedded SVG markup — `url("data:image/svg+xml;utf8,
 * <svg><rect fill='#3355ff'/></svg>")` — paints pixels on the page exactly
 * as `background: #3355ff` does, so a colour declared inside it is a real
 * declared colour, not prose that happens to be colour-shaped. Blanking it
 * anyway would silently under-count a page that hides a real brand colour
 * inside an icon.
 * @param {string} text
 * @returns {string}
 */
function blankQuotedStringContents(text) {
  let out = "";
  let quote = null;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (quote) {
      if (ch === "\\" && i + 1 < text.length) {
        out += "  ";
        i += 2;
        continue;
      }
      if (ch === quote) {
        quote = null;
        out += ch;
        i++;
        continue;
      }
      out += " ";
      i++;
      continue;
    }
    if (isUrlCallStart(text, i)) {
      const end = findUrlCallEnd(text, i + 4);
      out += blankBase64Payload(text.slice(i, end));
      i = end;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      out += ch;
      i++;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * blanks the CUSTOM-PROPERTY-NAME token of every var(...) reference in
 * `text` — from "var(" up to the first "," or the matching ")", whichever
 * comes first (the name itself: `--[A-Za-z0-9-]+` immediately after "var("
 * and any leading whitespace) — length-preserving (replaced with spaces),
 * leaving everything else untouched. A custom property NAME is ordinary
 * naming, not a declared colour: `--icon-red` and `--brand-blue` are
 * common, and the substring "red" or "blue" inside the name must never
 * reach the colour scan, the same defect class as a class name or a
 * comment. The optional FALLBACK after the name is deliberately NOT
 * blanked: `var(--accent, #ff0000)` really does put red on the page if
 * `--accent` is unset, so blanking the whole argument list would stop
 * counting a fallback that genuinely declares a colour. A var() whose
 * named property resolves to a real colour is not double-counted by
 * leaving its name blanked either: that colour is already counted once,
 * at the custom property's own declaration (`--brand-blue: #...;`)
 * elsewhere in the stylesheet — this function only stops the REFERENCE
 * from being read a second time, as if it were a value in its own right.
 * @param {string} text
 * @returns {string}
 */
function blankVarPropertyNames(text) {
  return text.replace(
    /\bvar\(\s*(--[A-Za-z0-9-]+)/gi,
    (match, name) =>
      match.slice(0, match.length - name.length) + " ".repeat(name.length),
  );
}

/**
 * every distinct colour this CSS text declares, as `{ r, g, b, h, s, l }`,
 * deduplicated by its resolved (r, g, b) triple so the same colour declared
 * twice (e.g. once in a base :root and again in an explicit
 * :root[data-theme="light"] override) counts once.
 * @param {string} cssText
 * @returns {Array<{ r: number, g: number, b: number, h: number, s: number, l: number }>}
 */
function distinctColorsIn(cssText) {
  const byKey = new Map();
  const add = (rgb) => {
    if (!rgb || [rgb.r, rgb.g, rgb.b].some((v) => Number.isNaN(v) || v < 0 || v > 255)) return;
    const key = `${rgb.r},${rgb.g},${rgb.b}`;
    if (byKey.has(key)) return;
    byKey.set(key, { ...rgb, ...rgbToHsl(rgb.r, rgb.g, rgb.b) });
  };

  const scanned = blankVarPropertyNames(blankQuotedStringContents(cssText));

  for (const m of scanned.matchAll(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi)) {
    add(hexToRgb(m[1].toLowerCase()));
  }
  for (const m of scanned.matchAll(/\brgba?\(\s*([^)]+)\)/gi)) {
    const tokens = m[1].split(/[\s,/]+/).filter(Boolean);
    if (tokens.length < 3) continue;
    const channel = (token) =>
      token.endsWith("%") ? Math.round((parseFloat(token) / 100) * 255) : Math.round(parseFloat(token));
    add({ r: channel(tokens[0]), g: channel(tokens[1]), b: channel(tokens[2]) });
  }
  for (const m of scanned.matchAll(/\bhsla?\(\s*([^)]+)\)/gi)) {
    const tokens = m[1].split(/[\s,/]+/).filter(Boolean);
    if (tokens.length < 3) continue;
    const h = parseAngle(tokens[0]);
    const s = parsePercent(tokens[1]);
    const l = parsePercent(tokens[2]);
    if ([h, s, l].some(Number.isNaN)) continue;
    add(hslToRgb(h, s, l));
  }
  for (const m of scanned.matchAll(NAMED_COLOR_RE)) {
    add(hexToRgb(NAMED_COLORS[m[1].toLowerCase()].slice(1)));
  }

  return [...byKey.values()];
}

/**
 * CSS colour functions this script does not attempt to classify: `oklch()`,
 * `lch()`, `lab()`, and `hwb()`. Their channels are not directly comparable
 * to the HSL saturation this factor's thresholds are calibrated against
 * (measured against the wireframe kit's own hex palette — see this file's
 * header), and inventing a chroma threshold for them with nothing to
 * calibrate it against would be a worse defect than the under-count it
 * would replace: a page that declares its greys through one of these
 * functions is a case this script refuses to judge, not one it guesses at.
 *
 * `color-mix()` is deliberately NOT on this list, though it shares the
 * same "channels this script cannot blend" shape. wireframe-kit.html's own
 * boilerplate uses it five times (`.modal-scrim`, `.wc-frame .scrim`,
 * `.wc-table .trow.sel`, `.wc-spin`, `.browser .win .scrim`), all inside
 * the one <style> block every primitive and archetype shares, and nothing
 * prompts a model to prune those rules — so refusing on it blanked this
 * factor for any run that copied the kit at all, on the treatment arm
 * only (the skill-absent arm never installs wireframe-design and so never
 * has the kit to copy), which is the exact treatment-arm asymmetry this
 * scenario's own design otherwise avoids. Its operands are left to be
 * scanned as ordinary value text instead (see declarationValuesIn and
 * distinctColorsIn below) rather than resolved or blended: every operand
 * in the kit is a var() naming a custom property declared with a literal
 * elsewhere in the same block, so that literal is already counted at its
 * own declaration and scanning color-mix()'s own text loses nothing for a
 * kit-derived page; a hand-authored page that introduces a hue ONLY inside
 * a color-mix() with a literal operand (`color-mix(in srgb, coral 50%,
 * white)`) still gets that literal counted, since it is ordinary value
 * text. The blend ratio itself is not modelled — a faint tint counts as
 * its full hue family — which is over-strict rather than under-strict,
 * the safe direction for a factor whose job is to catch a fidelity
 * violation, not to under-count one.
 */
const UNSUPPORTED_COLOR_FUNCTIONS = ["oklch", "lch", "lab", "hwb"];

/**
 * every unsupported colour function (see UNSUPPORTED_COLOR_FUNCTIONS) this
 * CSS text invokes, matched as a function call — the name immediately
 * followed by "(" — case-insensitively.
 * @param {string} cssText
 * @returns {string[]} the distinct function names found, sorted
 */
function unsupportedColorFunctionsIn(cssText) {
  const found = new Set();
  for (const name of UNSUPPORTED_COLOR_FUNCTIONS) {
    if (new RegExp(`\\b${name}\\s*\\(`, "i").test(cssText)) found.add(name);
  }
  return [...found].sort();
}

const { candidates: htmlCandidates, readable, unreadable } = readAddedHtmlFiles(diff);

if (htmlCandidates.length === 0) {
  const evidence = "the diff added no HTML document at all — there is nothing to check for low-fidelity colour discipline";
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

if (readable.length === 0) {
  fail(
    `the diff added ${htmlCandidates.length} HTML path(s) that the reconstructed workspace does not actually contain: ${unreadable.join("; ")}`,
  );
}

const unsupportedByFile = readable
  .map(({ path, content }) => {
    const found = unsupportedColorFunctionsIn(cssDeclarationText(content));
    return found.length > 0 ? `${path} declares colour via ${found.join(", ")}` : null;
  })
  .filter(Boolean);

if (unsupportedByFile.length > 0) {
  fail(
    `cannot judge low-fidelity colour discipline — this script classifies hex, rgb()/rgba(), hsl()/hsla(), and CSS named colours only, and ${unsupportedByFile.join("; ")}, which it does not attempt to convert or classify`,
  );
}

const perFile = readable.map(({ path, content }) => {
  const colors = distinctColorsIn(cssDeclarationText(content));
  const achromatic = colors.filter((c) => c.s <= ACHROMATIC_SATURATION_MAX);
  const chromatic = colors.filter((c) => c.s > ACHROMATIC_SATURATION_MAX);
  const hueFamilies = new Set(chromatic.map((c) => Math.floor((((c.h % 360) + 360) % 360) / HUE_BIN_WIDTH)));
  const passes = achromatic.length >= MIN_ACHROMATIC_VALUES && hueFamilies.size <= MAX_CHROMATIC_HUE_FAMILIES;
  return { path, passes, achromaticCount: achromatic.length, hueFamilyCount: hueFamilies.size };
});

const passing = perFile.find((entry) => entry.passes);

const result = passing !== undefined;
const evidence = result
  ? `${passing.path} declares ${passing.achromaticCount} distinct achromatic colour(s) (>= ${MIN_ACHROMATIC_VALUES} required) and ${passing.hueFamilyCount} chromatic hue famil(y/ies) (<= ${MAX_CHROMATIC_HUE_FAMILIES} allowed)`
  : perFile
      .map(
        ({ path, achromaticCount, hueFamilyCount }) =>
          `${path}: ${achromaticCount} distinct achromatic colour(s) (needs >= ${MIN_ACHROMATIC_VALUES}), ${hueFamilyCount} chromatic hue famil(y/ies) (needs <= ${MAX_CHROMATIC_HUE_FAMILIES})`,
      )
      .join(" | ");

process.stdout.write(`${JSON.stringify({ result, evidence })}\n`);
