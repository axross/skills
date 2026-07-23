# Privacy and Exposure Control

Apply these rules when reviewing whether a change exposes content, identifiers, environment values, analytics properties, or error context beyond the intended audience.

## Public Content Boundaries

The public surface may render published content, public profile data, public media assets, metadata, and search/discovery files. Unpublished, preview-only, admin-only fields, secrets, and operational identifiers are not public just because the author controls the content layer.

**Guidelines:**

- MUST flag a Critical when unpublished or preview content can be reached from a public route without the authenticated draft/preview path.
- MUST flag a Critical when sitemap, robots, structured data (e.g., JSON-LD), social-preview (Open Graph) image routes, or generated page metadata can expose unpublished content or private fields.
- MUST flag a Major when a public response exposes internal storage keys, database IDs, raw data-layer records, stack traces, or environment-derived values that are not required for the user-facing feature.
- SHOULD verify that public media exposure is intentional for the publicly served asset resources (media, cover images, avatar images, and any blob-backed assets).

## Client and Environment Exposure

Values sent to the browser/client are public. The framework's public/client-exposed env-var prefix is a release decision, not only a typing convenience.

**Guidelines:**

- MUST flag any newly exposed client-prefixed env value unless it is safe for every visitor to read.
- MUST flag a Critical when secrets, tokens, DSNs with auth tokens, admin emails, session values, or database URLs can reach client bundles, HTML, metadata, logs, or analytics payloads.
- MUST verify `process.env.*` access remains limited to the env-access files allowed by [secret-handling](./secret-handling.md).
- SHOULD ask for a narrower public value when a client component only needs a derived boolean or public identifier.

## Localhost / Production Divergence

Code gated to the local environment escapes every production test and review scenario, so its divergence from the production path surfaces only after deployment.

**Guidelines:**

- MUST flag a Major when the diff causes a code path to execute only when running locally (per the project's environment flag) but no equivalent exists for production — a localhost-only auth bypass that ships to production via a deployed branch is a recurring class of bug.
