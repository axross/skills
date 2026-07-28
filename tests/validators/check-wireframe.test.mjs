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

import { describe, expect, it } from "vitest";

import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { SCRIPTS, validator } from "../helpers/run.mjs";

const checkWireframe = validator(SCRIPTS.checkWireframe);

const page = (body) =>
  `<!doctype html>\n<html lang="en">\n<head><title>Wireframe</title></head>\n<body>\n${body}\n</body>\n</html>\n`;

/** Write a one-off wireframe page into a fresh temp directory. */
async function wireframe(body) {
  const root = await tempDir();
  return writeFileIn(root, "wireframe.html", page(body));
}

describe("check-wireframe.mjs", () => {
  it("exits 0 on a self-contained page with no placeholders", async () => {
    const file = await wireframe(
      '<h1>Dashboard</h1>\n<a href="#detail">Open detail</a>',
    );

    const result = checkWireframe(file);

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/^PASS {2}/m);
  });

  it.each([
    {
      what: "a leftover FILL: placeholder",
      body: "<h1>FILL: screen title</h1>",
      reported: /placeholder: leftover "FILL:" marker/,
    },
    {
      what: "leftover lorem ipsum filler",
      body: "<p>Lorem ipsum dolor sit amet</p>",
      reported: /lorem ipsum/i,
    },
    {
      what: "an external resource reference",
      body: '<img src="https://example.com/logo.png" alt="Logo">',
      reported: /https:\/\/example\.com\/logo\.png/,
    },
  ])("exits 1 on $what", async ({ body, reported }) => {
    const file = await wireframe(body);

    expect(checkWireframe(file)).toReportFailure(reported);
  });

  it("exits 1 when a file cannot be read", async () => {
    const root = await tempDir();

    expect(checkWireframe(`${root}/missing.html`)).toExitWith(1);
  });

  it("exits 2 when given no file arguments", () => {
    const result = checkWireframe();

    expect(result).toExitWith(2);
    expect(result.stderr).toMatch(/Usage: check-wireframe\.mjs/);
  });

  it("prints usage on --help", () => {
    const result = checkWireframe("--help");

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/^Usage: check-wireframe\.mjs/);
  });
});
