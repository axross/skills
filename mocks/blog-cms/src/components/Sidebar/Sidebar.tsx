import type { Site } from "../../types";
import css from "./Sidebar.module.css";

interface SidebarProps {
  readonly sites: readonly Site[];
  readonly currentSiteSlug: string;
  readonly onSwitchSite: (slug: string) => void;
}

/**
 * The persistent shell nav: a site switcher plus the (currently one-item)
 * section nav. Its layout is driven entirely by its own container width —
 * see Sidebar.module.css — not the viewport, so it re-tiers correctly
 * whatever width the surrounding shell actually gives it.
 */
export function Sidebar({ sites, currentSiteSlug, onSwitchSite }: SidebarProps) {
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

      <ul className={css.nav}>
        <li>
          <span className={css.navItem} aria-current="page">
            <span className={css.navIcon} aria-hidden="true">
              ▤
            </span>
            <span className={css.navLabel}>Posts</span>
          </span>
        </li>
      </ul>
    </nav>
  );
}
