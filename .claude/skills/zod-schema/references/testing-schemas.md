# Testing Schemas

Apply this reference when deciding which schemas earn a test, writing fixtures, asserting failures, or checking that a two-way boundary survives a round trip.

Verified against `zod@4.4.3` — <https://zod.dev/ecosystem>.

## Which Schemas Earn a Test

Not every schema does. A schema that is a plain restatement of a type — three required strings and a number — is tested by the compiler, and a test asserting it accepts a valid object asserts that Zod works.

What earns a test is the schema's **judgment**: the places where it accepts something surprising, rejects something plausible, or produces something different from what it received.

| Worth a test                                         | Why                                                       |
| ---------------------------------------------------- | --------------------------------------------------------- |
| The shape a producer actually emits                  | The schema's only real contract                           |
| A field that is nullable, optional, or both          | Each absent case is a branch the schema chose             |
| A transform's output                                 | The domain type is produced here, not declared            |
| A refinement                                         | Hand-written logic, hand-written bugs                     |
| A codec's encode direction                           | Not exercised by any read path                            |
| Every field a production bug proved could be missing | A regression guard, and the highest-value test of the set |

That last row is worth emphasizing. When a draft record turns out to lack a field the schema required, or a producer starts sending `null` where it sent a string, the fix is a schema change and a test that pins it — because nothing else prevents the next edit from reintroducing it.

**Guidelines:**

- MUST add a regression test pinning the accepted shape whenever a production failure is fixed by relaxing or changing a schema.
- MUST NOT write tests that assert Zod's own built-in checks work.
- SHOULD test the schema's judgment — its optionality choices, transforms, and refinements — rather than its field list.

## Fixtures Are Input

A fixture is what goes **into** a parse, so it is typed with `z.input<typeof Schema>`, not `z.infer` (see [transforms-and-pipes.md](./transforms-and-pipes.md)).

Typing a fixture with the output type works until the schema gains a transform, at which point every fixture fails to compile — or, worse, keeps compiling because the two types happen to coincide and silently stops representing what a producer sends.

**Example:**

```ts
type BlogPostInput = z.input<typeof BlogPost>;

const baseBlogPost: BlogPostInput = {
  slug: "example-post",
  title: "Example post",
  coverImage: null,
  publishedAt: "2026-05-04T00:00:00.000Z",
};
```

A branded schema (see [schema-modules.md](./schema-modules.md)) adds a wrinkle: a branded value cannot be written as a literal, so a fixture holding one must be produced by parsing. That is the cost of branding, and it is paid in the fixtures.

**Guidelines:**

- MUST type a fixture with `z.input<typeof Schema>`.
- MUST build a fixture from a real observed payload where one is available, rather than from the schema's own field list — a fixture derived from the schema cannot detect that the schema is wrong.
- SHOULD construct variant fixtures by spreading a base fixture, so a new required field breaks one declaration rather than twenty.

## Assert the Failures

A test suite that only asserts successes cannot distinguish a correct schema from one that accepts everything. Removing a required field from a schema breaks nothing in a happy-path-only suite.

Every constraint worth having is worth one rejection test: the field that must be present, the format that must hold, the bound that must not be exceeded, the cross-field rule.

The paired form is the most informative — one test that a permitted edge case is accepted, one that a neighbouring case is still rejected:

```ts
it("accepts a null cover image so autosaved drafts still parse", () => {
  expect(BlogPost.parse({ ...base, coverImage: null }).coverImage).toBeNull();
});

it("still rejects a cover image missing its Open Graph size", () => {
  const { sizes: _omitted, ...withoutSizes } = coverImage;

  expect(() => BlogPost.parse({ ...base, coverImage: withoutSizes })).toThrow();
});
```

**Guidelines:**

- MUST assert a rejection for every constraint the schema is relied upon to enforce.
- MUST pair a relaxation with a test that the neighbouring case is still rejected, so the relaxation is bounded.
- SHOULD assert on the issue `path` or `code` rather than the message, which is localizable (see [errors.md](./errors.md)).

## Round-Tripping a Codec

A codec's read half is exercised by every read path. Its write half usually is not, and the asymmetries in [codecs.md](./codecs.md) mean a working decode implies nothing about encode.

The test is a round trip: encode a decoded value and compare. What it catches is the field the decode side reads and the encode side forgets — which produces a record that loses data every time it is written back, silently, until someone notices the field is empty.

For a codec that is deliberately lossy, the round trip still belongs in a test, asserting exactly what is dropped rather than that nothing is.

**Guidelines:**

- MUST test the encode direction of every codec explicitly.
- MUST assert what a deliberately lossy codec drops, rather than skipping the round-trip test.
- SHOULD round-trip in both directions where the codec is inverted anywhere in the codebase.

## Generated and Fuzzed Data

Tools exist to generate values from a schema — for fuzzing, and for mock data. They are useful for what they can establish and routinely over-credited.

What they establish: the schema does not throw unexpectedly on values it should accept, and a downstream consumer handles the range of shapes the schema permits.

What they cannot establish: that the schema matches what the producer actually sends. Generated data is derived **from the schema**, so it can never detect that the schema is wrong — which is the failure mode that reaches production. A real observed payload is the only fixture that can.

**Guidelines:**

- MUST NOT rely on schema-generated data as the primary fixture for a boundary; it cannot detect a wrong schema.
- SHOULD use generated data to exercise a consumer across the range a schema permits, alongside real observed fixtures.
- SHOULD check a generation tool's supported Zod version before adopting it, since these tools trail the library.
