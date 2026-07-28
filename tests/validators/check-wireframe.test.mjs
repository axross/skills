// Exit-code smoke contract for check-wireframe.mjs.
//
// Documented contract: 0 when every checked file passes, 1 when one or more fail
// (or cannot be read), 2 on a bad invocation.
//
// Every fixture here is generated. `assets/wireframe-kit.html` also exits 1 —
// its `FILL:` markers are deliberate, and the script's header says so — but the
// assertion's subject is the validator's contract, not that asset. Binding this
// suite to a 748-line template would break it on an unrelated kit edit and would
// record a shipped asset as failing its own validator.

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { tempDir, writeFileIn } from "./helpers/fixtures.mjs";
import { SCRIPTS, runNodeScript } from "./helpers/run.mjs";

const page = (body) =>
  `<!doctype html>\n<html lang="en">\n<head><title>Wireframe</title></head>\n<body>\n${body}\n</body>\n</html>\n`;

const checkWireframe = (...args) =>
  runNodeScript(SCRIPTS.checkWireframe, args);

describe("check-wireframe.mjs", () => {
  it("exits 0 on a self-contained page with no placeholders", async (t) => {
    const root = await tempDir(t);
    const file = await writeFileIn(
      root,
      "wireframe.html",
      page('<h1>Dashboard</h1>\n<a href="#detail">Open detail</a>'),
    );

    const result = checkWireframe(file);

    assert.equal(result.code, 0, result.output);
    assert.match(result.stdout, /^PASS {2}/m);
  });

  it("exits 1 on a leftover FILL: placeholder", async (t) => {
    const root = await tempDir(t);
    const file = await writeFileIn(
      root,
      "wireframe.html",
      page("<h1>FILL: screen title</h1>"),
    );

    const result = checkWireframe(file);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /placeholder: leftover "FILL:" marker/);
  });

  it("exits 1 on leftover lorem ipsum filler", async (t) => {
    const root = await tempDir(t);
    const file = await writeFileIn(
      root,
      "wireframe.html",
      page("<p>Lorem ipsum dolor sit amet</p>"),
    );

    assert.equal(checkWireframe(file).code, 1);
  });

  it("exits 1 on an external resource reference", async (t) => {
    const root = await tempDir(t);
    const file = await writeFileIn(
      root,
      "wireframe.html",
      page('<img src="https://example.com/logo.png" alt="Logo">'),
    );

    const result = checkWireframe(file);

    assert.equal(result.code, 1);
    assert.match(result.stdout, /https:\/\/example\.com\/logo\.png/);
  });

  it("exits 1 when a file cannot be read", async (t) => {
    const root = await tempDir(t);

    assert.equal(checkWireframe(`${root}/missing.html`).code, 1);
  });

  it("exits 2 when given no file arguments", () => {
    const result = checkWireframe();

    assert.equal(result.code, 2);
    assert.match(result.stderr, /Usage: check-wireframe\.mjs/);
  });
});
