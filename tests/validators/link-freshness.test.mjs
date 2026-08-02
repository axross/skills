// Contract for the link-freshness audit.
//
// The audit's whole job is to reach the network, and NOTHING here does. That is
// the point rather than a limitation: `npm test` is a merge gate, and a gate
// that probes ~80 external publishers fails for reasons no contributor can fix.
// So the two halves that decide every verdict are pure and tested directly —
// extraction (which URLs the tree claims) and classification (what an answer
// means) — and the CLI is exercised only through `--dry-run` and its exit codes.
//
// The classification cases are the ones worth reading. Whether a 403 fails the
// run is the design decision this audit turns on, and it is asserted here rather
// than left to the prose in classify.mjs.

import { describe, expect, it } from "vitest";

import {
  isReservedAddress,
  refusalReason,
} from "../../scripts/link-freshness/address-guard.mjs";
import {
  ALIVE,
  classifyOutcome,
  DEAD,
  DEAD_STATUSES,
  failsRun,
  GET_FALLBACK_STATUSES,
  isRetryableStatus,
  MOVED,
  UNVERIFIABLE,
} from "../../scripts/link-freshness/classify.mjs";
import {
  collectUrls,
  extractUrls,
} from "../../scripts/link-freshness/urls.mjs";
import { tempDir, writeFileIn } from "../helpers/fixtures.mjs";
import { runScript, SCRIPTS } from "../helpers/run.mjs";

const audit = (...args) => runScript(SCRIPTS.linkFreshness, args);

/** Just the URLs a document cites, in order. */
const urlsIn = (source) => extractUrls(source).map((entry) => entry.url);

describe("extractUrls", () => {
  it("finds a URL in running prose", () => {
    expect(urlsIn("See https://example.com/docs for detail.\n")).toEqual([
      "https://example.com/docs",
    ]);
  });

  it("finds a URL inside a Markdown link without swallowing the closing paren", () => {
    expect(urlsIn("See [the docs](https://example.com/a/b) first.\n")).toEqual([
      "https://example.com/a/b",
    ]);
  });

  it("reports the 1-based line each URL sits on", () => {
    const source = ["# Title", "", "See https://example.com/x.", ""].join("\n");

    expect(extractUrls(source)).toEqual([{ url: "https://example.com/x", line: 3 }]);
  });

  it("strips sentence punctuation from the end of a URL", () => {
    expect(urlsIn("Read https://example.com/guide.\n")).toEqual([
      "https://example.com/guide",
    ]);
  });

  describe("text that shows a URL rather than citing one", () => {
    it("ignores a URL inside a fenced code block", () => {
      const source = [
        "Before.",
        "",
        "```bash",
        "curl https://example.com/never-probed",
        "```",
        "",
        "After.",
        "",
      ].join("\n");

      expect(urlsIn(source)).toEqual([]);
    });

    it("ignores a URL inside an inline code span", () => {
      expect(urlsIn("Set the endpoint to `https://example.com/never-probed`.\n")).toEqual(
        [],
      );
    });

    it("ignores a URL inside an HTML comment", () => {
      expect(urlsIn("<!-- parked: https://example.com/never-probed -->\nText.\n")).toEqual(
        [],
      );
    });

    it("ignores a URL inside a multi-line HTML comment", () => {
      const source = [
        "<!--",
        "parked: https://example.com/never-probed",
        "-->",
        "See https://example.com/real.",
        "",
      ].join("\n");

      expect(urlsIn(source)).toEqual(["https://example.com/real"]);
    });
  });

  describe("a comment opener that is only being quoted", () => {
    it("does not let an inline-code `<!--` swallow the prose after it", () => {
      // README.md documents the `count:` marker rule with the sentence "a line
      // beginning with `<!--` is an HTML block in CommonMark" — a comment opener
      // inside an inline code span. Stripping comments from the RAW source
      // believes that opener and discards everything up to the next `-->`, which
      // in README.md was ~90 lines later: real prose, real links, silently
      // unread. Blanking code spans FIRST is what makes an opener have to be
      // real text to count.
      //
      // The ordering now lives in commonmark.mjs (#185), shared with
      // check-links.mjs, which carried the same defect until then. This case
      // stays here anyway: it asserts what THIS module's callers get, and would
      // catch a future extractUrls that stopped going through extractProse.
      const source = [
        "A line beginning with `<!--` is an HTML block in CommonMark.",
        "",
        "See https://example.com/still-found.",
        "",
        "<!-- count:things -->three<!-- /count -->",
        "",
        "And https://example.com/also-found.",
        "",
      ].join("\n");

      expect(urlsIn(source)).toEqual([
        "https://example.com/still-found",
        "https://example.com/also-found",
      ]);
    });

    it("keeps reporting true line numbers after a stripped comment", () => {
      const source = [
        "<!--",
        "parked",
        "-->",
        "See https://example.com/x.",
        "",
      ].join("\n");

      // The comment is removed, but its newlines are not: line 4 is still line 4.
      expect(extractUrls(source)).toEqual([{ url: "https://example.com/x", line: 4 }]);
    });

    it("treats an unterminated comment opener as content rather than stopping", () => {
      // A dangling `<!--` comments out the rest of a rendered document, but
      // honouring it here would silently stop extracting — the failure mode that
      // looks like a clean result.
      const source = ["<!-- dangling", "See https://example.com/x.", ""].join("\n");

      expect(urlsIn(source)).toEqual(["https://example.com/x"]);
    });
  });
});

describe("collectUrls", () => {
  it("deduplicates one URL across files and keeps every site", async () => {
    const root = await tempDir();
    await writeFileIn(root, "a.md", "See https://example.com/shared.\n");
    await writeFileIn(root, "nested/b.md", "Also https://example.com/shared.\n");

    const { urls, fileCount, siteCount } = await collectUrls([root]);

    expect(urls).toHaveLength(1);
    expect(urls[0].url).toBe("https://example.com/shared");
    expect(urls[0].sites).toHaveLength(2);
    expect(fileCount).toBe(2);
    expect(siteCount).toBe(2);
  });

  it("names each site as file:line", async () => {
    const root = await tempDir();
    await writeFileIn(root, "a.md", "# T\n\nSee https://example.com/x.\n");

    const { urls } = await collectUrls([root]);

    expect(urls[0].sites[0]).toBe(`${root}/a.md:3`);
  });

  it("sorts URLs and their sites, so two runs diff cleanly", async () => {
    const root = await tempDir();
    await writeFileIn(root, "z.md", "https://example.com/b\n");
    await writeFileIn(root, "a.md", "https://example.com/a\nhttps://example.com/b\n");

    const { urls } = await collectUrls([root]);

    expect(urls.map((entry) => entry.url)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(urls[1].sites).toEqual([...urls[1].sites].sort());
  });

  it("reads no file from a root that does not exist", async () => {
    const { urls, fileCount } = await collectUrls(["/no/such/root/anywhere"]);

    expect(urls).toEqual([]);
    expect(fileCount).toBe(0);
  });
});

describe("classifyOutcome", () => {
  const status = (code, extra = {}) =>
    classifyOutcome({ kind: "status", status: code, ...extra }).verdict;

  it.each([200, 204, 299])("calls %i alive", (code) => {
    expect(status(code)).toBe(ALIVE);
  });

  it("calls a 2xx reached through a permanent redirect moved, not alive", () => {
    expect(
      status(200, { permanentRedirect: true, finalUrl: "https://example.com/new" }),
    ).toBe(MOVED);
  });

  it("names the destination in a moved verdict, since that is the fix", () => {
    const { detail } = classifyOutcome({
      kind: "status",
      status: 200,
      permanentRedirect: true,
      finalUrl: "https://example.com/new",
    });

    expect(detail).toContain("https://example.com/new");
  });

  it.each([404, 410])("calls %i dead", (code) => {
    expect(status(code)).toBe(DEAD);
  });

  describe("answers that are about the requester, not the resource", () => {
    // The design decision the whole audit turns on. Each of these describes the
    // REQUEST or the requester — a throttle, a paywall, a jurisdiction, a server
    // fault — and a link a human reads fine is not rot in this repository.
    it.each([
      { code: 401, why: "a paywall or login wall" },
      { code: 403, why: "a host blocking datacentre egress" },
      { code: 429, why: "a rate limit" },
      { code: 451, why: "a legal block in the runner's jurisdiction" },
      { code: 500, why: "a server fault" },
      { code: 503, why: "an outage" },
    ])("calls $code unverifiable ($why)", ({ code }) => {
      expect(status(code)).toBe(UNVERIFIABLE);
    });

    it("excludes them from the statuses that mean gone", () => {
      for (const code of [400, 401, 403, 429, 451, 500]) {
        expect(DEAD_STATUSES.has(code)).toBe(false);
      }
    });
  });

  it("calls a transport failure unverifiable and repeats the reason", () => {
    const result = classifyOutcome({ kind: "error", reason: "timed out" });

    expect(result.verdict).toBe(UNVERIFIABLE);
    expect(result.detail).toBe("timed out");
  });
});

describe("retry and fallback policy", () => {
  it.each([429, 500, 502, 503, 504])("retries %i, which describes a moment", (code) => {
    expect(isRetryableStatus(code)).toBe(true);
  });

  it.each([200, 301, 403, 404, 410])("does not retry %i, which is an answer", (code) => {
    expect(isRetryableStatus(code)).toBe(false);
  });

  it.each([403, 405, 501])(
    "retries %i with GET, because it means 'not like that' rather than 'not here'",
    (code) => {
      expect(GET_FALLBACK_STATUSES.has(code)).toBe(true);
    },
  );

  it("does not retry a 404 with GET as a fallback status", () => {
    // A 404 IS re-checked, but by the dead-confirmation pass rather than this
    // one — conflating the two would skip the confirming request.
    expect(GET_FALLBACK_STATUSES.has(404)).toBe(false);
  });
});

describe("failsRun", () => {
  it("fails on a dead link", () => {
    expect(failsRun([ALIVE, UNVERIFIABLE, DEAD])).toBe(true);
  });

  it("does not fail on unverifiable or moved links alone", () => {
    // The claim the workflow's whole design rests on: a throttling publisher
    // cannot turn this audit red.
    expect(failsRun([ALIVE, MOVED, UNVERIFIABLE])).toBe(false);
  });

  it("does not fail on an empty run", () => {
    expect(failsRun([])).toBe(false);
  });
});

describe("isReservedAddress", () => {
  // Pure and offline, which is the point: the redirect guard's whole rule is
  // testable without a resolver or a socket.
  describe("IPv4", () => {
    it.each([
      { address: "127.0.0.1", range: "loopback" },
      { address: "10.1.2.3", range: "RFC 1918" },
      { address: "172.16.0.1", range: "RFC 1918, low edge" },
      { address: "172.31.255.254", range: "RFC 1918, high edge" },
      { address: "192.168.1.1", range: "RFC 1918" },
      { address: "169.254.169.254", range: "cloud metadata" },
      { address: "100.64.0.1", range: "carrier-grade NAT" },
      { address: "0.0.0.0", range: "this network" },
      { address: "198.18.0.1", range: "benchmarking" },
      { address: "224.0.0.1", range: "multicast" },
      { address: "255.255.255.255", range: "broadcast" },
    ])("refuses $address ($range)", ({ address }) => {
      expect(isReservedAddress(address)).toBe(true);
    });

    it.each(["8.8.8.8", "1.1.1.1", "140.82.121.4", "172.15.0.1", "172.32.0.1"])(
      "allows the public address %s",
      (address) => {
        expect(isReservedAddress(address)).toBe(false);
      },
    );

    it("does not mistake a neighbour of a private range for a private address", () => {
      // 172.16.0.0/12 runs to 172.31.255.255 — an off-by-one mask would swallow
      // 172.32.x, and a naive prefix match would swallow 172.15.x.
      expect(isReservedAddress("172.15.255.255")).toBe(false);
      expect(isReservedAddress("172.32.0.0")).toBe(false);
    });
  });

  describe("IPv6", () => {
    it.each([
      { address: "::1", range: "loopback" },
      { address: "::", range: "unspecified" },
      { address: "fc00::1", range: "unique local" },
      { address: "fd12:3456::1", range: "unique local" },
      { address: "fe80::1", range: "link-local" },
      { address: "ff02::1", range: "multicast" },
    ])("refuses $address ($range)", ({ address }) => {
      expect(isReservedAddress(address)).toBe(true);
    });

    it.each(["2606:4700:4700::1111", "2001:4860:4860::8888"])(
      "allows the public address %s",
      (address) => {
        expect(isReservedAddress(address)).toBe(false);
      },
    );

    it("judges an IPv4-mapped address by the IPv4 inside it", () => {
      // The bypass this exists for: ::ffff:169.254.169.254 reaches exactly the
      // same endpoint as 169.254.169.254 and matches none of the IPv6 prefixes.
      expect(isReservedAddress("::ffff:169.254.169.254")).toBe(true);
      expect(isReservedAddress("::ffff:127.0.0.1")).toBe(true);
      expect(isReservedAddress("::ffff:8.8.8.8")).toBe(false);
    });

    it("strips a zone identifier before judging", () => {
      expect(isReservedAddress("fe80::1%eth0")).toBe(true);
    });
  });

  it("refuses anything it cannot parse", () => {
    // An address this cannot understand is one it cannot vouch for, so the
    // failure direction is refusal rather than a probe.
    for (const address of ["not-an-address", "1.2.3", "::ffff::1", ""]) {
      expect(isReservedAddress(address)).toBe(true);
    }
  });
});

describe("refusalReason", () => {
  it("refuses a URL naming a reserved address literally", async () => {
    expect(await refusalReason("http://169.254.169.254/latest/meta-data/")).toMatch(
      /reserved address/,
    );
  });

  it("refuses a bracketed IPv6 loopback", async () => {
    expect(await refusalReason("http://[::1]:8080/")).toMatch(/reserved address/);
  });

  it.each(["file:///etc/passwd", "gopher://example.com/", "ftp://example.com/"])(
    "refuses the non-HTTP scheme in %s",
    async (target) => {
      // A `location` header can name any scheme at all, so the audit picks the
      // two it probes rather than letting fetch decide.
      expect(await refusalReason(target)).toMatch(/non-HTTP scheme/);
    },
  );

  it("refuses a string that is not a URL", async () => {
    expect(await refusalReason("http://[unclosed")).toMatch(/not a valid URL/);
  });

  it("allows a public IP literal without consulting DNS", async () => {
    expect(await refusalReason("https://8.8.8.8/")).toBeNull();
  });

  it("classifies a refusal as unverifiable, never as dead", () => {
    // A refused hop must not fail the run: the citation is not proven gone, and
    // a redirect the audit declined to follow is not this repository's defect.
    const result = classifyOutcome({
      kind: "error",
      reason: "refused: reserved address (169.254.169.254)",
    });

    expect(result.verdict).toBe(UNVERIFIABLE);
    expect(failsRun([result.verdict])).toBe(false);
  });
});

describe("the command-line contract", () => {
  it("exits 0 for --help and prints usage", () => {
    const result = audit("--help");

    expect(result).toPassCleanly();
    expect(result.stdout).toMatch(/Usage: check\.mjs/);
  });

  it("documents every exit code in its usage", () => {
    const { stdout } = audit("--help");

    expect(stdout).toMatch(/Exit codes: 0 .*, 1 .*, 2 /);
  });

  it("exits 0 from --dry-run and says no request was made", async () => {
    const root = await tempDir();
    await writeFileIn(root, "a.md", "See https://example.com/x.\n");

    const result = audit("--dry-run", root);

    expect(result).toPassCleanly();
    expect(result.stdout).toContain("https://example.com/x");
    expect(result.stdout).toContain("No network request was made.");
  });

  it("lists each site under its URL in --dry-run", async () => {
    const root = await tempDir();
    await writeFileIn(root, "a.md", "https://example.com/x\n");

    expect(audit("--dry-run", root).stdout).toContain(`${root}/a.md:1`);
  });

  it("exits 0 on a tree citing no external URL", async () => {
    const root = await tempDir();
    await writeFileIn(root, "a.md", "# Title\n\nNo links here.\n");

    const result = audit(root);

    expect(result).toPassCleanly();
    expect(result.stdout).toContain("No external URLs found");
  });

  it.each([
    { label: "an unknown flag", args: ["--bogus"] },
    { label: "a non-numeric concurrency", args: ["--concurrency", "many"] },
    { label: "a negative timeout", args: ["--timeout", "-1"] },
  ])("exits 2 on $label", ({ args }) => {
    expect(audit(...args)).toExitWith(2);
  });

  it("produces byte-identical --dry-run output across runs", async () => {
    // Stable enough to diff between runs: nothing checkout-dependent may leak in.
    const root = await tempDir();
    await writeFileIn(root, "a.md", "https://example.com/b\nhttps://example.com/a\n");

    expect(audit("--dry-run", root).stdout).toBe(audit("--dry-run", root).stdout);
  });
});
