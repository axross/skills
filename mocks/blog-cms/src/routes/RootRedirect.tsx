import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router";
import { getSitesQueryOptions } from "../queries/sites/sites-query";

/** `/` has no page of its own — it resolves to whichever site loads first and redirects into its post list. */
export function RootRedirect() {
  const sitesQuery = useQuery(getSitesQueryOptions());

  if (sitesQuery.isPending) return null;

  if (sitesQuery.isError) {
    return <p role="alert">Couldn't load your sites. Try reloading the page.</p>;
  }

  const firstSite = sitesQuery.data[0];
  if (!firstSite) {
    return <p>Your account doesn't manage any sites yet.</p>;
  }

  return <Navigate to={`/sites/${firstSite.slug}/posts`} replace />;
}
