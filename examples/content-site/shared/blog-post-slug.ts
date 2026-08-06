import { z } from "zod";

/** Upper bound on a post slug's length, enforced by the schema below. */
export const MAX_SLUG_LENGTH = 96;

/**
 * Shape of a post slug: lowercase alphanumeric groups joined by single
 * hyphens, with no leading, trailing, or doubled hyphen. A slug becomes part
 * of a URL path and a cache key, so it is validated before either is built
 * from it rather than trusted as-is.
 */
export const PostSlug = z
	.string()
	.min(1)
	.max(MAX_SLUG_LENGTH)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export type PostSlug = z.infer<typeof PostSlug>;

/** Message shown next to a slug field that failed {@link PostSlug}. */
export const SLUG_VALIDATION_MESSAGE =
	"Use lowercase letters, numbers, and single hyphens (e.g. my-post-title).";
