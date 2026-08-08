import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { resolveTranslation } from "@/shared/resolve-translation";
import { findPostBySlug } from "../../posts-data";

interface PostPageProps {
	params: Promise<{ slug: string }>;
}

/**
 * The reader's accepted locales, most preferred first, parsed from the
 * request's `Accept-Language` header — the same preference order
 * {@link resolveTranslation} expects. A missing header resolves to an empty
 * list, which falls through resolution to the post's default locale.
 */
function acceptedLocales(acceptLanguage: string | null): string[] {
	if (!acceptLanguage) return [];

	return acceptLanguage
		.split(",")
		.map((entry) => entry.split(";")[0].trim())
		.filter((locale) => locale.length > 0);
}

/**
 * Post detail page. {@link resolveTranslation} turns the reader's accepted
 * locales plus the post's own translations into the one translation this page
 * renders.
 */
export default async function PostPage({ params }: PostPageProps) {
	const { slug } = await params;
	const post = findPostBySlug(slug);
	if (!post) notFound();

	const requestHeaders = await headers();
	const translation = resolveTranslation(
		post,
		acceptedLocales(requestHeaders.get("accept-language")),
	);
	if (!translation) notFound();

	return (
		<article>
			<h1>{translation.title}</h1>
			<p>{translation.body}</p>
		</article>
	);
}
