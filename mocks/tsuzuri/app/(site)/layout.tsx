import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
	title: {
		default: "tsuzuri",
		template: "%s · tsuzuri",
	},
	description: "A personal blog: portrait, bio, and posts.",
};

/**
 * Root layout for the `(site)` route group — the reader-facing pages. The
 * admin/API surface this fixture drops lived in a sibling route group in the
 * project this is thinned from; here `(site)` is the only one.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="ja">
			<body>
				<header>
					<a href="/">tsuzuri</a>
				</header>
				<main>{children}</main>
			</body>
		</html>
	);
}
