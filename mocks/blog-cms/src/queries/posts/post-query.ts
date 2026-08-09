import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api";

export function getPostQueryOptions(siteSlug: string, postId: number) {
  return queryOptions({
    queryKey: ["sites", siteSlug, "posts", postId] as const,
    queryFn: () => api.getPost(siteSlug, postId),
  });
}
