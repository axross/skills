import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import { Card } from "../components/Card/Card";
import { cx } from "../lib/class-names";
import { getPostListQueryOptions } from "../queries/posts/post-list-query";
import css from "./PostListPage.module.css";

export function PostListPage() {
  const { siteSlug = "" } = useParams();
  const postsQuery = useQuery(getPostListQueryOptions(siteSlug));

  return (
    <section>
      <h1 className={css.heading}>Posts</h1>

      {postsQuery.isPending && <p>Loading posts…</p>}

      {postsQuery.isError && (
        <p role="alert">Couldn't load this site's posts. Try reloading the page.</p>
      )}

      {postsQuery.isSuccess && postsQuery.data.length === 0 && (
        <p>This site doesn't have any posts yet.</p>
      )}

      {postsQuery.isSuccess && postsQuery.data.length > 0 && (
        <ul className={css.list} aria-label="Posts">
          {postsQuery.data.map((post) => (
            <li key={post.id}>
              <Link to={`/sites/${siteSlug}/posts/${post.id}`} className={css.cardLink}>
                <Card>
                  <p className={css.title}>{post.title}</p>
                  <div className={css.meta}>
                    <span
                      className={cx(
                        css.status,
                        post.status === "published" ? css.statusPublished : css.statusDraft,
                      )}
                    >
                      {post.status}
                    </span>
                    <span>Updated {new Date(post.updatedAt).toLocaleDateString()}</span>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
