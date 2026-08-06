import { describe, expect, it } from "@jest/globals";
import { MAX_SLUG_LENGTH, PostSlug } from "./blog-post-slug";

describe("PostSlug", () => {
	it("accepts a single lowercase word", () => {
		expect(PostSlug.safeParse("hello").success).toBe(true);
	});

	it("accepts hyphen-separated lowercase words and digits", () => {
		expect(PostSlug.safeParse("my-post-title").success).toBe(true);
		expect(PostSlug.safeParse("post-2024-recap").success).toBe(true);
	});

	it("rejects an empty slug", () => {
		expect(PostSlug.safeParse("").success).toBe(false);
	});

	it("rejects a leading, trailing, or doubled hyphen", () => {
		expect(PostSlug.safeParse("-hello").success).toBe(false);
		expect(PostSlug.safeParse("hello-").success).toBe(false);
		expect(PostSlug.safeParse("he--llo").success).toBe(false);
	});

	it("rejects uppercase letters", () => {
		expect(PostSlug.safeParse("Hello").success).toBe(false);
	});

	it("rejects a slug longer than the limit", () => {
		const atLimit = "a".repeat(MAX_SLUG_LENGTH);
		const tooLong = "a".repeat(MAX_SLUG_LENGTH + 1);

		expect(PostSlug.safeParse(atLimit).success).toBe(true);
		expect(PostSlug.safeParse(tooLong).success).toBe(false);
	});

	it("rejects a non-string value", () => {
		expect(PostSlug.safeParse(undefined).success).toBe(false);
		expect(PostSlug.safeParse(null).success).toBe(false);
		expect(PostSlug.safeParse(["hello"]).success).toBe(false);
	});
});
