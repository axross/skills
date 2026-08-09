import { queryOptions } from "@tanstack/react-query";
import { api } from "../../lib/api";

export function getSitesQueryOptions() {
  return queryOptions({
    queryKey: ["sites"] as const,
    queryFn: () => api.listSites(),
    staleTime: 60_000,
  });
}
