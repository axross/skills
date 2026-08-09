import { mutationOptions } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { getPostListQueryOptions } from "./post-list-query";
import { getPostQueryOptions } from "./post-query";

// The publish mutation is the one TanStack Query write in this app that has
// to invalidate: a published post has to fall out of the site's stale list
// the instant the request settles, or the editor reads its own success as a
// no-op.
export function getPostPublishMutationOptions(siteSlug: string, postId: number) {
  return mutationOptions({
    mutationKey: ["sites", siteSlug, "posts", postId, "publish"] as const,
    mutationFn: () => api.publishPost(siteSlug, postId),
    onSuccess: (_data, _variables, _onMutateResult, context) =>
      Promise.all([
        context.client.invalidateQueries({ queryKey: getPostListQueryOptions(siteSlug).queryKey }),
        context.client.invalidateQueries({
          queryKey: getPostQueryOptions(siteSlug, postId).queryKey,
        }),
      ]),
  });
}
