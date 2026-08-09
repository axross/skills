import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Site } from "../../types";
import { Sidebar } from "./Sidebar";

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
// wrapper directly rather than resizing the page — see rcs-container-query's
// substrate note in AGENTS.md for why this behaviour has to stay correct.
function renderInside(widthPx: number) {
  return render(
    <div style={{ width: `${widthPx}px` }}>
      <Sidebar sites={SITES} currentSiteSlug="acme" onSwitchSite={vi.fn()} />
    </div>,
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
      <div style={{ width: "320px" }}>
        <Sidebar sites={SITES} currentSiteSlug="acme" onSwitchSite={onSwitchSite} />
      </div>,
    );

    const select = getByRole("combobox") as HTMLSelectElement;
    select.value = "northwind";
    select.dispatchEvent(new Event("change", { bubbles: true }));

    expect(onSwitchSite).toHaveBeenCalledWith("northwind");
  });
});
