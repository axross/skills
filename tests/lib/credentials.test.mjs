// the environment going into a spawned CLI, and the transcript coming out.
//
// the credentials planted below are literals invented for these tests. none is
// real, and none has ever been.

import { describe, expect, it } from "vitest";

import {
  credentialValues,
  findCredentialShapes,
  redactCredentials,
  redactTranscript,
  stripCredentials,
} from "../../tools/lib/credentials.mjs";

describe("stripCredentials", () => {
  it("withholds anything whose name looks like a credential", () => {
    const env = stripCredentials({
      PATH: "/usr/bin",
      DEPLOY_TOKEN: "xyzzy",
      MY_SECRET: "xyzzy",
      DB_PASSWORD: "xyzzy",
      SOME_CREDENTIAL: "xyzzy",
      API_KEY: "xyzzy",
    });
    expect(Object.keys(env)).toEqual(["PATH"]);
  });

  it("keeps the two the CLI cannot authenticate without", () => {
    // they match the denylist by name and are kept anyway, which is exactly
    // why redaction on the way out exists.
    const env = stripCredentials({
      CLAUDE_CODE_OAUTH_TOKEN: "kept",
      ANTHROPIC_API_KEY: "kept",
      UNRELATED_TOKEN: "dropped",
    });
    expect(env).toEqual({ CLAUDE_CODE_OAUTH_TOKEN: "kept", ANTHROPIC_API_KEY: "kept" });
  });

  it("drops an undefined value rather than passing the string 'undefined'", () => {
    expect(stripCredentials({ PATH: "/usr/bin", EMPTY: undefined })).toEqual({ PATH: "/usr/bin" });
  });
});

describe("credentialValues", () => {
  it("ignores a value too short to redact safely", () => {
    // redacting `1` would turn every `1` in a transcript into a placeholder.
    expect(credentialValues({ SHORT_TOKEN: "1" })).toEqual([]);
  });

  it("orders longest first, so a credential containing another is replaced whole", () => {
    const values = credentialValues({
      A_TOKEN: "abcdefgh",
      B_TOKEN: "abcdefghijklmnop",
    });
    expect(values.map((entry) => entry.name)).toEqual(["B_TOKEN", "A_TOKEN"]);
  });
});

describe("redactCredentials", () => {
  it("replaces a planted credential's literal bytes and names the variable", () => {
    const source = { CLAUDE_CODE_OAUTH_TOKEN: "sk-ant-oat01-PLANTEDVALUE0000" };
    const transcript = `{"type":"result","note":"leaked ${source.CLAUDE_CODE_OAUTH_TOKEN} here"}`;

    const { text, redacted } = redactCredentials(transcript, credentialValues(source));

    expect(text).not.toContain(source.CLAUDE_CODE_OAUTH_TOKEN);
    expect(text).toContain("[redacted:CLAUDE_CODE_OAUTH_TOKEN]");
    expect(redacted).toEqual(["CLAUDE_CODE_OAUTH_TOKEN"]);
  });

  it("replaces every occurrence, not only the first", () => {
    const source = { MY_TOKEN: "abcdefghijkl" };
    const { text } = redactCredentials("abcdefghijkl and abcdefghijkl", credentialValues(source));
    expect(text).toBe("[redacted:MY_TOKEN] and [redacted:MY_TOKEN]");
  });

  it("also covers the form a credential takes inside a JSON string", () => {
    // a token holding a quote or a backslash reaches JSONL through
    // JSON.stringify, so its literal bytes are not what lands on disk.
    const value = 'we"ird\\token-value';
    const line = JSON.stringify({ note: value });
    const { text } = redactCredentials(line, credentialValues({ ODD_TOKEN: value }));
    expect(text).toContain("[redacted:ODD_TOKEN]");
    expect(text).not.toContain("we\\\"ird");
  });

  it("reports nothing when the transcript is clean", () => {
    const { text, redacted } = redactCredentials(
      '{"type":"result"}',
      credentialValues({ MY_TOKEN: "abcdefghijkl" }),
    );
    expect(text).toBe('{"type":"result"}');
    expect(redacted).toEqual([]);
  });
});

describe("findCredentialShapes", () => {
  it.each([
    ["an Anthropic API key", "sk-ant-api03-AAAAAAAAAAAAAAAAAAAA", "Anthropic API key"],
    ["a GitHub token", "ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", "GitHub token"],
    ["a JWT", "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.sig", "JSON Web Token"],
  ])("matches %s", (_label, planted, shape) => {
    expect(findCredentialShapes(`noise ${planted} noise`)).toContain(shape);
  });

  it("does not match ordinary transcript text", () => {
    expect(findCredentialShapes('{"type":"result","total_cost_usd":0.42}')).toEqual([]);
  });
});

describe("redactTranscript", () => {
  it("redacts a planted credential it knows the bytes of", () => {
    const value = "sk-ant-oat01-PLANTEDVALUE0000";
    const { text } = redactTranscript(`leaked ${value}`, { CLAUDE_CODE_OAUTH_TOKEN: value });
    expect(text).toBe("leaked [redacted:CLAUDE_CODE_OAUTH_TOKEN]");
  });

  it("REFUSES when a credential shape survives redaction", () => {
    // a token this process never held reaches the transcript, so redaction by
    // value cannot have removed it. refusing costs a paid probe; writing it
    // would cost the credential.
    expect(() => redactTranscript("leaked ghp_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", {})).toThrow(
      /still matches GitHub token/,
    );
  });

  it("does not refuse once the by-value pass has removed the match", () => {
    const value = "ghp_CCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
    expect(() => redactTranscript(`leaked ${value}`, { GH_TOKEN: value })).not.toThrow();
  });
});
