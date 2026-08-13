import { useQuery } from "@tanstack/react-query";
import { Outlet, useNavigate, useParams } from "react-router";
import { Sidebar } from "../components/Sidebar/Sidebar";
import { trackEvent } from "../lib/analytics";
import { getSitesQueryOptions } from "../queries/sites/sites-query";
import css from "./Layout.module.css";

/** The persistent shell every route renders inside: the sidebar plus whichever page is current. */
export function Layout() {
  const { siteSlug = "" } = useParams();
  const navigate = useNavigate();
  const sitesQuery = useQuery(getSitesQueryOptions());

  function switchSite(slug: string) {
    trackEvent("Site switched", { from_site: siteSlug, to_site: slug });
    navigate(`/sites/${slug}/posts`);
  }

  return (
    <div className={css.shell}>
      <Sidebar sites={sitesQuery.data ?? []} currentSiteSlug={siteSlug} onSwitchSite={switchSite} />
      <main className={css.content}>
        <Outlet />
      </main>
    </div>
  );
}
