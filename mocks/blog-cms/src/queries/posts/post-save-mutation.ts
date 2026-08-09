import { mutationOptions } from "@tanstack/react-query";
import { api } from "../../lib/api";
import type { SavePostInput } from "../../types";
import { getPostQueryOptions } from "./post-query";

export function getPostSaveMutationOptions(siteSlug: string, postId: number) {
  return mutationOptions({
    mutationKey: ["sites", siteSlug, "posts", postId, "save"] as const,
    mutationFn: (input: SavePostInput) => api.savePost(siteSlug, postId, input),
    onSuccess: (data, _variables, _onMutateResult, context) =>
      context.client.setQueryData(getPostQueryOptions(siteSlug, postId).queryKey, data),
  });
}
