import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { Card } from "../components/Card/Card";
import { getRevisionListQueryOptions } from "../queries/revisions/revision-list-query";
import type { Revision } from "../types";
import css from "./RevisionsPage.module.css";

interface PostGroup {
  readonly postId: number;
  readonly postTitle: string;
  readonly revisions: Revision[];
}

// The API hands these back newest first across the whole site, which is the
// order each post's own snapshots should keep. Grouping preserves it, and the
// groups come out ordered by whichever post was published most recently.
function groupByPost(revisions: readonly Revision[]): PostGroup[] {
  const groups = new Map<number, PostGroup>();

  for (const revision of revisions) {
    const group = groups.get(revision.postId);
    if (group) {
      group.revisions.push(revision);
      continue;
    }
    groups.set(revision.postId, {
      postId: revision.postId,
      postTitle: revision.postTitle,
      revisions: [revision],
    });
  }

  return [...groups.values()];
}

export function RevisionsPage() {
  const { siteSlug = "" } = useParams();
  const revisionsQuery = useQuery(getRevisionListQueryOptions(siteSlug));

  return (
    <section>
      <h1 className={css.heading}>Revisions</h1>

      {revisionsQuery.isPending && <p>Loading revisions…</p>}

      {revisionsQuery.isError && (
        <p role="alert">Couldn't load this site's revisions. Try reloading the page.</p>
      )}

      {revisionsQuery.isSuccess && revisionsQuery.data.length === 0 && (
        <p>
          Nothing has been published on this site yet. Publishing a post snapshots it here, so you
          can see what actually went out.
        </p>
      )}

      {revisionsQuery.isSuccess && revisionsQuery.data.length > 0 && (
        <ul className={css.groups} aria-label="Revisions">
          {groupByPost(revisionsQuery.data).map((group) => (
            <li key={group.postId}>
              <h2 className={css.postTitle}>{group.postTitle}</h2>
              <ul className={css.snapshots}>
                {group.revisions.map((revision) => (
                  <li key={revision.id}>
                    <Card>
                      <p className={css.snapshotTitle}>{revision.title}</p>
                      <p className={css.snapshotMeta}>
                        Published {new Date(revision.createdAt).toLocaleString()}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
