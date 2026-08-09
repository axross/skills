import { render } from "@testing-library/react";
import { page, userEvent } from "vitest/browser";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button";

describe("Button", () => {
  it("fires onClick on a real pointer click", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Publish</Button>);

    await userEvent.click(page.getByRole("button", { name: "Publish" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("is disabled and unclickable while loading", async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Publishing…
      </Button>,
    );

    const button = page.getByRole("button", { name: "Publishing…" });
    await expect.element(button).toBeDisabled();
    await expect.element(button).toHaveAttribute("aria-busy", "true");
  });

  it("disabled prop also prevents clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Publish
      </Button>,
    );

    await expect.element(page.getByRole("button", { name: "Publish" })).toBeDisabled();
  });

  it("merges a caller className onto the root element alongside its own", () => {
    const { container } = render(<Button className="mt-4">Publish</Button>);

    const button = container.querySelector("button");
    expect(button?.className).toContain("mt-4");
  });

  it("renders the error state without disabling the button", async () => {
    render(<Button error>Publish</Button>);

    const button = page.getByRole("button", { name: "Publish" });
    await expect.element(button).not.toBeDisabled();
  });
});
