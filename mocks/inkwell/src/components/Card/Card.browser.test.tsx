import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card";

describe("Card", () => {
  it("renders its children", () => {
    const { getByText } = render(<Card>Hello there</Card>);

    expect(getByText("Hello there")).toBeInTheDocument();
  });

  it("merges a caller className with its own root class", () => {
    const { container } = render(<Card className="wide">Hello there</Card>);

    const root = container.firstElementChild;
    expect(root?.className).toContain("wide");
    // Its own module class is still present alongside the caller's.
    expect(root?.className.length).toBeGreaterThan("wide".length);
  });
});
