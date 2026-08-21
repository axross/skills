import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api";

// Rooted on the site slug for the same reason the post list is — see
// post-query-keys.test.ts.
export function getRevisionListQueryOptions(siteSlug: string) {
  return queryOptions({
    queryKey: ["sites", siteSlug, "revisions"] as const,
    queryFn: () => api.listRevisions(siteSlug),
  });
}
