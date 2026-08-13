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
 * Root layout for the `(site)` route group — the reader-facing pages. It is
 * the only route group so far: there is no admin console or API surface yet
 * to warrant a second one.
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
