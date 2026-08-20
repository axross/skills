import { NavLink } from "react-router";
import { cx } from "../../lib/class-names";
import type { Author, Site } from "../../types";
import css from "./Sidebar.module.css";

interface SidebarProps {
  readonly sites: readonly Site[];
  readonly currentSiteSlug: string;
  readonly onSwitchSite: (slug: string) => void;
  readonly author?: Author;
}

const SECTIONS = [
  { path: "posts", icon: "▤", label: "Posts" },
  { path: "revisions", icon: "◷", label: "Revisions" },
] as const;

/**
 * The persistent shell nav: a site switcher, the section nav, and whoever is
 * signed in. Its layout is driven entirely by its own container width — see
 * Sidebar.module.css — not the viewport, so it re-tiers correctly whatever
 * width the surrounding shell actually gives it.
 */
export function Sidebar({ sites, currentSiteSlug, onSwitchSite, author }: SidebarProps) {
  return (
    <nav className={css.sidebar} aria-label="Site">
      <label className={css.switcherLabel}>
        <span className={css.srOnly}>Switch site</span>
        <select
          className={css.switcherSelect}
          value={currentSiteSlug}
          onChange={(event) => onSwitchSite(event.target.value)}
        >
          {sites.map((site) => (
            <option key={site.slug} value={site.slug}>
              {site.name}
            </option>
          ))}
        </select>
      </label>

      {/* The root path renders this shell too, before RootRedirect has picked a
          site — there is nothing for a section to link to until it has. */}
      {currentSiteSlug !== "" && (
        <ul className={css.nav}>
          {SECTIONS.map((section) => (
            <li key={section.path}>
              <NavLink
                to={`/sites/${currentSiteSlug}/${section.path}`}
                className={({ isActive }) => cx(css.navItem, isActive && css.navItemCurrent)}
              >
                <span className={css.navIcon} aria-hidden="true">
                  {section.icon}
                </span>
                <span className={css.navLabel}>{section.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}

      {author && (
        <div className={css.author}>
          <span className={css.authorAvatar} aria-hidden="true">
            {author.name.slice(0, 1)}
          </span>
          <span className={css.authorName}>{author.name}</span>
        </div>
      )}
    </nav>
  );
}
