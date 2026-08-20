import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { Outlet, useNavigate, useParams } from "react-router";
import { Sidebar } from "../components/Sidebar/Sidebar";
import { identifyAuthor, trackEvent } from "../lib/analytics";
import { useConsent } from "../lib/consent";
import { getAuthorQueryOptions } from "../queries/author/author-query";
import { getSitesQueryOptions } from "../queries/sites/sites-query";
import css from "./Layout.module.css";

/** The persistent shell every route renders inside: the sidebar plus whichever page is current. */
export function Layout() {
  const { siteSlug = "" } = useParams();
  const navigate = useNavigate();
  const sitesQuery = useQuery(getSitesQueryOptions());
  const authorQuery = useQuery(getAuthorQueryOptions());
  const { status } = useConsent();
  const identifiedAuthorId = useRef<string | null>(null);

  const author = authorQuery.data;

  // Consent and the author resolve independently and in either order, so this
  // waits for both. A granted answer is not yet a started SDK — the provider
  // starts it from its own effect, which runs after this one — and
  // lib/analytics.ts is what holds the author across that gap. The ref keeps a
  // re-render from identifying the same author twice.
  useEffect(() => {
    if (status !== "granted" || !author || identifiedAuthorId.current === author.id) return;

    identifiedAuthorId.current = author.id;
    identifyAuthor(author);
  }, [status, author]);

  function switchSite(slug: string) {
    trackEvent("Site switched", { from_site: siteSlug, to_site: slug });
    navigate(`/sites/${slug}/posts`);
  }

  return (
    <div className={css.shell}>
      <Sidebar
        sites={sitesQuery.data ?? []}
        currentSiteSlug={siteSlug}
        onSwitchSite={switchSite}
        author={author}
      />
      <main className={css.content}>
        <Outlet />
      </main>
    </div>
  );
}
