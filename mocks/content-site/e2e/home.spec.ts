import { expect, test } from "@playwright/test";

// Not wired into `npm test` or CI here — see playwright.config.ts's header.
// This fixture keeps the file to preserve the project's real shape: end-to-end
// specs read like a reader driving the browser, one behavior per test, apart
// from the unit specs colocated with the code they cover under shared/.

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
