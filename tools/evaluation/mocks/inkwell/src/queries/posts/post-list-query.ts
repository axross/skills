import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api";

// The site slug rooting this key is what keeps two sites' post lists apart —
// see post-query-keys.test.ts.
export function getPostListQueryOptions(siteSlug: string) {
  return queryOptions({
    queryKey: ["sites", siteSlug, "posts"] as const,
    queryFn: () => api.listPosts(siteSlug),
  });
}
