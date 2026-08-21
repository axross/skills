import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api";

// Who the author is only changes when the session does, and a session change
// reloads the app, so this can sit in the cache far longer than a post can.
export function getAuthorQueryOptions() {
  return queryOptions({
    queryKey: ["author"] as const,
    queryFn: () => api.getAuthor(),
    staleTime: 15 * 60_000,
  });
}
