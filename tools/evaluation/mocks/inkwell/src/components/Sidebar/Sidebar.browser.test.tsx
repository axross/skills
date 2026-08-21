import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import type { Author, Site } from "../../types";
import { Sidebar } from "./Sidebar";

const AUTHOR: Author = { id: "author_1", name: "Ada Whitfield", siteCount: 2 };

const SITES: readonly Site[] = [
  { id: 1, name: "Acme Blog", slug: "acme", deployHookUrl: "https://hooks.example.invalid/acme" },
  {
    id: 2,
    name: "Northwind Notes",
    slug: "northwind",
    deployHookUrl: "https://hooks.example.invalid/nw",
  },
];

// The container query in Sidebar.module.css reacts to the sidebar's own box,
// not the browser viewport, so the two cases below give it a fixed-width
// wrapper directly rather than resizing the page. Resizing the viewport would
// pass for the wrong reason here and fail the moment the sidebar is rendered
// anywhere narrower than the window. The router is here because the section
// nav renders links, and a link needs one to resolve against.
function renderInside(widthPx: number) {
  return render(
    <MemoryRouter initialEntries={["/sites/acme/posts"]}>
      <div style={{ width: `${widthPx}px` }}>
        <Sidebar sites={SITES} currentSiteSlug="acme" onSwitchSite={vi.fn()} author={AUTHOR} />
      </div>
    </MemoryRouter>,
  );
}

describe("Sidebar", () => {
  it("shows the nav label text when its container is wide", async () => {
    const { getByText } = renderInside(320);

    const label = getByText("Posts");
    await expect.poll(() => getComputedStyle(label).display).not.toBe("none");
  });

  it("hides the nav label and centers the icon when its container is narrow", async () => {
    const { getByText } = renderInside(140);

    const label = getByText("Posts");
    await expect.poll(() => getComputedStyle(label).display).toBe("none");
  });

  it("links every section to the current site, marking the one being viewed", () => {
    const { getByRole } = renderInside(320);

    expect(getByRole("link", { name: /Posts/ })).toHaveAttribute("href", "/sites/acme/posts");
    expect(getByRole("link", { name: /Revisions/ })).toHaveAttribute(
      "href",
      "/sites/acme/revisions",
    );
    expect(getByRole("link", { name: /Posts/ })).toHaveAttribute("aria-current", "page");
  });

  it("drops the author's name with the nav labels, leaving the avatar", async () => {
    const wide = renderInside(320);
    await expect
      .poll(() => getComputedStyle(wide.getByText("Ada Whitfield")).display)
      .not.toBe("none");
    wide.unmount();

    const narrow = renderInside(140);
    await expect
      .poll(() => getComputedStyle(narrow.getByText("Ada Whitfield")).display)
      .toBe("none");
  });

  it("always exposes the site switcher, in both tiers", async () => {
    const wide = renderInside(320);
    expect(wide.getByRole("combobox")).toBeInTheDocument();
    wide.unmount();

    const narrow = renderInside(140);
    expect(narrow.getByRole("combobox")).toBeInTheDocument();
  });

  it("calls onSwitchSite with the newly selected site's slug", async () => {
    const onSwitchSite = vi.fn();
    const { getByRole } = render(
      <MemoryRouter initialEntries={["/sites/acme/posts"]}>
        <div style={{ width: "320px" }}>
          <Sidebar sites={SITES} currentSiteSlug="acme" onSwitchSite={onSwitchSite} />
        </div>
      </MemoryRouter>,
    );

    const select = getByRole("combobox") as HTMLSelectElement;
    select.value = "northwind";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onSwitchSite).toHaveBeenCalledWith("northwind");
  });
});
