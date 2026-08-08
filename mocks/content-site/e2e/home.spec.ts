import { expect, test } from "@playwright/test";

// One behavior per test, read as a reader driving the browser — see
// playwright.config.ts for the server these run against.

test("home page lists every post as a link to its detail page", async ({
	page,
}) => {
	await page.goto("/");

	const posts = page.getByRole("list", { name: "posts" }).getByRole("listitem");

	await expect(posts).not.toHaveCount(0);
	for (const post of await posts.all()) {
		await expect(post.getByRole("link")).toHaveAttribute("href", /^\/posts\//);
	}
});

test("visiting an unknown post slug renders the not-found page", async ({
	page,
}) => {
	const response = await page.goto("/posts/does-not-exist");

	expect(response?.status()).toBe(404);
});
