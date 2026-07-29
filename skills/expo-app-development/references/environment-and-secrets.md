# Environment and Secrets

Apply this reference when reading an environment variable in app code, adding a variable to a build, deciding whether a value may live in the client at all, or arranging `.env` files.

## What the Public Prefix Does

Expo inlines environment variables whose names carry the public prefix (`EXPO_PUBLIC_`) into the JavaScript bundle **at build time**. The consequence is exact and often misread: the value is not read from the environment when the app runs — it is substituted into the bundle as a literal before shipping. Anyone with the app has it.

The prefix is therefore a declaration that a value is public. It is not a mechanism for supplying configuration, and changing the value requires a new build.

**Guidelines:**

- MUST treat every value carrying the public prefix as published to anyone who installs the app.
- MUST rebuild after changing a public variable; the running app holds the value from its own build.
- MUST NOT use a public variable for anything that varies per user, per session, or per environment at runtime — fetch that instead.

## Accessing an Inlined Variable

The substitution is a textual one performed by the bundler, so it only happens where the bundler can see a direct static property access on the environment object. Destructuring it, indexing it with a computed key, or passing the object around defeats the substitution and yields `undefined` in a production build while appearing to work in development.

**Example:**

```ts
// Substituted at build time.
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

// Not substituted — undefined in a production bundle.
const { EXPO_PUBLIC_SENTRY_DSN } = process.env;
const dsn2 = process.env[`EXPO_PUBLIC_${name}`];
```

**Guidelines:**

- MUST access a public variable as a direct static property of the environment object.
- MUST NOT destructure the environment object, index it with a computed key, or forward it as a value.
- SHOULD verify a newly added variable in a production-configuration build, since the failure mode is invisible in development.

## One Module Owns Environment Access

Read the environment in exactly one module, validate it there, and export typed values. Scattered access makes it impossible to answer what the app requires from its environment, and pushes every consumer into repeating an `undefined` check that one of them will forget.

Validating at that boundary turns a misconfigured build into an immediate, legible failure rather than an unexplained absence of behavior much later.

**Example:**

```ts
// src/core/helpers/env.ts — the only module that touches process.env
export const envSchema = z.object({
  EXPO_PUBLIC_SENTRY_DSN: z.url().optional(),
});

export const env = envSchema.parse({
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN || undefined,
});
```

**Guidelines:**

- MUST confine environment access to one module, and have the rest of the app import from it.
- MUST validate the environment at that boundary, and give each value the type its consumers need rather than a bare string.
- SHOULD state which variables are optional and what the app does without them, rather than letting each consumer decide.
- SHOULD keep an empty string from reaching a consumer as a value; normalize it to absent where the variable is read.

## What Never Carries the Prefix

A credential that grants access on the holder's behalf must not be in the client, prefix or otherwise. API keys with write scope, signing keys, client secrets, database credentials, and upload tokens all belong to a server or to the build pipeline — the first because the client should not hold them, the second because the build needs them and the app does not.

Some values are legitimately public despite reading like secrets: an error tracker's ingest key, an analytics write-only token, a public application identifier. Their being public is a property of the service's design, not an assumption to make on their behalf — confirm it in the service's own documentation before adding the prefix.

**Guidelines:**

- MUST NOT give the public prefix to a credential that authorizes anything beyond anonymous, write-only ingestion.
- MUST supply a build-time-only secret through the build pipeline's own secret storage, never through a prefixed variable.
- MUST confirm from the service's documentation that a key is designed to be public before treating it as such.
- SHOULD move a value that turns out not to be publishable behind a server endpoint rather than obfuscating it in the client.

## Ordering and Committing `.env` Files

Expo loads several `.env` files with a defined precedence, so a value can be set as a shared default and overridden per machine or per mode. The distinction that matters for version control is between the file that documents the app's requirements and the files that hold a particular machine's values.

**Guidelines:**

- MUST commit an example file listing every variable the app reads, with placeholder values.
- MUST NOT commit a file holding real per-machine or per-environment values, and MUST ignore it in version control.
- SHOULD keep committed defaults limited to values that are the same for every developer and genuinely public.
- SHOULD state the precedence the project relies on where the project documents its setup, since the ordering is not visible from the files.
