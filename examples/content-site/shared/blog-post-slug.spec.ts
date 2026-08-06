import { describe, expect, it } from "@jest/globals";
import { MAX_SLUG_LENGTH, PostSlug } from "./blog-post-slug";

describe("PostSlug", () => {
	it("MAX_SLUG_LENGTH is 96", () => {
		expect(MAX_SLUG_LENGTH).toBe(96);
	});

	it("safeParse returns success", () => {
		expect(PostSlug.safeParse("hello").success).toBe(true);
		expect(PostSlug.safeParse("my-post-title").success).toBe(true);
		expect(PostSlug.safeParse("post-2024-recap").success).toBe(true);
	});

	it("regex", () => {
		expect(PostSlug.safeParse("Hello").success).toBe(false);
		expect(PostSlug.safeParse("he--llo").success).toBe(false);
	});

	it("rejects an empty slug", () => {
		expect(PostSlug.safeParse("").success).toBe(false);
	});

	it("max", () => {
		const tooLong = "a".repeat(MAX_SLUG_LENGTH + 1);

		expect(PostSlug.safeParse(tooLong).success).toBe(false);
	});
});
