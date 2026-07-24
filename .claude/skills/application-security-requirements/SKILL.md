---
name: application-security-requirements
description: The security and privacy review lens for code changes. Covers secrets/env vars, the framework's public/client-exposed env-var prefix, input validation, public exposure, output-encoding/injection in rendered untrusted content, SSRF/outbound fetch of user-controlled URLs, and dependency supply-chain risk.
when_to_use: Use when reviewing security or privacy implications of a change — "is this safe", "security", "secret", "privacy", "PII", "XSS", "SSRF", or dependency reviews.
user-invocable: false
---

# Application Security Requirements

Apply these rules when reviewing the security implications of any change in this project. The framing is OWASP Top 10. The secret-handling and supply-chain sections apply directly to this repository and its npm dependencies; the input-validation, injection, and SSRF sections apply to any JavaScript tooling the library adds that handles external input, renders untrusted content, or fetches user-controlled URLs.

## Secret and Environment-Variable Handling

See [secret-handling.md](./references/secret-handling.md) for:

- No literal secret committed (any service credential, token, or test password)
- `process.env.*` accessed only inside the project's whitelisted env-access files
- The framework's public/client-exposed env-var prefix convention used only for values intentionally exposed to the browser/client
- `.env.local` is gitignored; any committed example env file (e.g. `.env.example`) contains no real secret values

## Input Validation

See [input-validation.md](./references/input-validation.md) for:

- All request handlers validate and coerce request inputs before passing them to the data layer or an outbound `fetch`
- All route params / query params are treated as untrusted (their static types do not guarantee their runtime shape)
- Data-layer queries receive sanitized values (no type-coercion bypass on identifiers)
- Data-layer return values are parsed through the project's schema/validation library before reaching consumers

## Privacy and Exposure Control

See [privacy-and-exposure.md](./references/privacy-and-exposure.md) for:

- Unpublished, preview, admin-only, and private content cannot leak through public routes, metadata, structured data, sitemap, robots, or media routes
- Public media/asset URLs expose only intentionally public assets and do not reveal private storage tokens or internal identifiers
- Client-exposed environment variables are intentionally public
- Localhost-gated code paths have an equivalent production path (no localhost-only bypass that ships to production)

## Injection in Rendered Untrusted Content

See [xss-in-markdown.md](./references/xss-in-markdown.md) for:

- Rich-text / markdown / HTML rendering of untrusted (user- or CMS-authored) content does not pass user-controlled values into raw-HTML sinks or unsanitized attributes
- Dangerous URL protocols (e.g., `javascript:`) are stripped or neutralized before reaching a rendered attribute
- Custom render nodes only emit attributes that the rendering layer encodes safely
- The framework's safe-encoding path is not bypassed (no manual string interpolation of untrusted content into markup)

## SSRF and Outbound Fetch

See [ssrf-and-embeds.md](./references/ssrf-and-embeds.md) for:

- Any code that `fetch`-es a user- or CMS-controlled URL cannot be steered at internal-network hosts in production
- Image/asset rendering does not bypass the host allowlist for user-controlled URLs
- New user-controlled URLs that flow into a `fetch` call go through an allowlist or a hostname check
- New entries in the config allowlist of external hosts are tightly scoped

## Supply Chain

See [supply-chain.md](./references/supply-chain.md) for:

- New dependencies justify their addition per the project's software-development practices (change-management rules)
- New dependencies are reasonably popular, maintained, and platform-agnostic
- Lockfile is updated; transitive additions are inspected for known-vulnerable versions
- No `postinstall` / `prepare` script in a new dependency runs unexpected code
