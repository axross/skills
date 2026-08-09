import { POSTS } from "./posts-data";

/** The home page: portrait, bio, and a list of posts linking to their detail page. */
export default function HomePage() {
	return (
		<>
			<section aria-label="profile">
				<h1>tsuzuri</h1>
				<p>A personal blog.</p>
			</section>
			<ul aria-label="posts">
				{POSTS.map((post) => (
					<li key={post.slug}>
						<a href={`/posts/${post.slug}`}>{post.slug}</a>
					</li>
				))}
			</ul>
		</>
	);
}
