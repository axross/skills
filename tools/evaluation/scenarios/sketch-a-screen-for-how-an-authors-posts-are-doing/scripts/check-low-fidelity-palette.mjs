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
// HSL, and require
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
// usage: node check-low-fidelity-palette.mjs <context.json>

import { readFileSync } from "node:fs";

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

/** every path this unified diff ADDED, from its "--- /dev/null" / "+++ b/<path>" pair. */
function addedFilesFromDiff(diffText) {
  const added = new Set();
  const lines = diffText.split("\n");
  for (let i = 0; i < lines.length - 1; i++) {
    if (lines[i] === "--- /dev/null" && lines[i + 1].startsWith("+++ ")) {
      added.add(lines[i + 1].slice(4).replace(/^b\//, "").trim());
    }
  }
  return added;
}

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
 * extracts the text a document actually DECLARES colour in: every
 * <style>...</style> block, plus every style="..." attribute value. Colour
 * words appearing only in visible prose (a heading, a label) are not
 * declarations and are deliberately excluded, so this factor is never
 * tripped by, say, a screen whose copy happens to mention "orange".
 * @param {string} html
 * @returns {string}
 */
function cssDeclarationText(html) {
  const parts = [];
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) parts.push(m[1]);
  for (const m of html.matchAll(/\bstyle\s*=\s*"([^"]*)"/gi)) parts.push(m[1]);
  for (const m of html.matchAll(/\bstyle\s*=\s*'([^']*)'/gi)) parts.push(m[1]);
  return parts.join("\n");
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

  for (const m of cssText.matchAll(/#([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{4}|[0-9a-f]{3})\b/gi)) {
    add(hexToRgb(m[1].toLowerCase()));
  }
  for (const m of cssText.matchAll(/\brgba?\(\s*([^)]+)\)/gi)) {
    const tokens = m[1].split(/[\s,/]+/).filter(Boolean);
    if (tokens.length < 3) continue;
    const channel = (token) =>
      token.endsWith("%") ? Math.round((parseFloat(token) / 100) * 255) : Math.round(parseFloat(token));
    add({ r: channel(tokens[0]), g: channel(tokens[1]), b: channel(tokens[2]) });
  }
  for (const m of cssText.matchAll(/\bhsla?\(\s*([^)]+)\)/gi)) {
    const tokens = m[1].split(/[\s,/]+/).filter(Boolean);
    if (tokens.length < 3) continue;
    const h = parseAngle(tokens[0]);
    const s = parsePercent(tokens[1]);
    const l = parsePercent(tokens[2]);
    if ([h, s, l].some(Number.isNaN)) continue;
    add(hslToRgb(h, s, l));
  }
  for (const m of cssText.matchAll(NAMED_COLOR_RE)) {
    add(hexToRgb(NAMED_COLORS[m[1].toLowerCase()].slice(1)));
  }

  return [...byKey.values()];
}

const addedFiles = [...addedFilesFromDiff(diff)];
const htmlCandidates = addedFiles.filter((path) => /\.html?$/i.test(path)).sort();

if (htmlCandidates.length === 0) {
  const evidence = "the diff added no HTML document at all — there is nothing to check for low-fidelity colour discipline";
  process.stdout.write(`${JSON.stringify({ result: false, evidence })}\n`);
  process.exit(0);
}

const readable = [];
const unreadable = [];
for (const path of htmlCandidates) {
  try {
    readable.push({ path, content: readFileSync(path, "utf8") });
  } catch (error) {
    unreadable.push(`${path} (${error.message})`);
  }
}

if (readable.length === 0) {
  fail(
    `the diff added ${htmlCandidates.length} HTML path(s) that the reconstructed workspace does not actually contain: ${unreadable.join("; ")}`,
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
