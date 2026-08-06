import type { Post } from "@/shared/resolve-translation";

/**
 * The post catalog. A real deployment reads this from a content backend; this
 * thinned fixture inlines it instead, since the fixture's point is the code
 * that reads posts, not where they are stored.
 */
export const POSTS: readonly Post[] = [
	{
		slug: "hello-world",
		defaultLocale: "ja-JP",
		translations: [
			{
				locale: "ja-JP",
				title: "はじめまして",
				body: "このブログについて書きました。",
			},
			{
				locale: "en-US",
				title: "Hello, world",
				body: "A short note about this blog.",
			},
		],
	},
	{
		slug: "on-writing-in-two-languages",
		defaultLocale: "ja-JP",
		translations: [
			{
				locale: "ja",
				title: "二言語で書くということ",
				body: "日本語と英語で書く理由について。",
			},
		],
	},
	{
		slug: "draft-notes",
		defaultLocale: "ja-JP",
		// A post that has not been translated into anything yet.
		translations: [],
	},
];

/** The post whose slug is `slug`, or `undefined` when the catalog has none. */
export function findPostBySlug(slug: string): Post | undefined {
	return POSTS.find((post) => post.slug === slug);
}
