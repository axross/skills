/**
 * A single localized rendering of a post: the language it is written in, plus
 * the fields a reader sees.
 */
export interface PostTranslation {
	/** BCP-47-shaped locale tag, e.g. "ja-JP", "en-US", or a bare language subtag like "ja". */
	locale: string;
	title: string;
	body: string;
}

/**
 * A post as the content layer stores it: zero or more {@link PostTranslation}
 * entries, plus the locale the post falls back to when nothing else matches.
 */
export interface Post {
	slug: string;
	/** The locale a reader is shown when none of their accepted locales match. */
	defaultLocale: string;
	translations: PostTranslation[];
}

/**
 * Lowercases a locale tag so `"EN-US"`, `"en-us"`, and `"en-US"` compare equal.
 * Locale tags are case-insensitive by spec (BCP 47 §2.1.1); this project
 * normalizes rather than trusting every caller to pass a canonical tag.
 */
export function normalizeLocale(locale: string): string {
	return locale.trim().toLowerCase();
}

/** The primary language subtag of a locale tag: `"ja-JP"` → `"ja"`, `"en"` → `"en"`. */
function languageSubtag(locale: string): string {
	return normalizeLocale(locale).split("-")[0];
}

/**
 * A translation whose locale tag is identical to `locale` once both are
 * normalized. `"en-US"` matches a translation tagged `"en-US"`, but not one
 * tagged `"en"` or `"en-GB"` — that broader match is {@link findLanguageMatch}.
 */
export function findExactMatch(
	post: Post,
	locale: string,
): PostTranslation | null {
	const target = normalizeLocale(locale);

	return (
		post.translations.find(
			(translation) => normalizeLocale(translation.locale) === target,
		) ?? null
	);
}

/**
 * A translation that shares `locale`'s primary language subtag, regardless of
 * region. A request for `"ja-JP"` reaches a translation tagged plain `"ja"`
 * (and vice versa: a request for `"ja"` reaches one tagged `"ja-JP"`), which is
 * what lets a post carry one translation per *language* rather than one per
 * region a reader might be browsing from.
 */
export function findLanguageMatch(
	post: Post,
	locale: string,
): PostTranslation | null {
	const target = languageSubtag(locale);

	return (
		post.translations.find(
			(translation) => languageSubtag(translation.locale) === target,
		) ?? null
	);
}

/**
 * Picks the translation to render for a reader, given the locales they accept
 * in preference order (most preferred first — the same order an
 * `Accept-Language` header implies once its quality values are resolved).
 *
 * Resolution order:
 *
 * 1. The first accepted locale with an **exact** translation match.
 * 2. Failing that, the first accepted locale with a **language-only** match
 *    (so `ja-JP` reaches a `ja` translation).
 * 3. Failing that, the post's {@link Post.defaultLocale | default locale}'s
 *    translation, if the post has one.
 * 4. `null`, when nothing above matched — in particular, whenever the post
 *    carries no translations at all.
 */
export function resolveTranslation(
	post: Post,
	acceptedLocales: readonly string[],
): PostTranslation | null {
	for (const locale of acceptedLocales) {
		const exact = findExactMatch(post, locale);
		if (exact) return exact;
	}

	for (const locale of acceptedLocales) {
		const byLanguage = findLanguageMatch(post, locale);
		if (byLanguage) return byLanguage;
	}

	return findExactMatch(post, post.defaultLocale);
}
