import { fireEvent, render, screen } from "@testing-library/react-native";

import { SwipeCard } from "./swipe-card";

describe("SwipeCard", () => {
  it("shows the front when not revealed", async () => {
    await render(
      <SwipeCard
        front="H"
        back="Hydrogen"
        revealed={false}
        onReveal={() => {}}
        onGrade={() => {}}
      />,
    );

    expect(screen.getByTestId("study-card")).toBeOnTheScreen();
    expect(screen.getByText("H")).toBeOnTheScreen();
    expect(screen.queryByText("Hydrogen")).toBeNull();
  });

  it("shows the back when revealed", async () => {
    await render(
      <SwipeCard
        front="H"
        back="Hydrogen"
        revealed={true}
        onReveal={() => {}}
        onGrade={() => {}}
      />,
    );

    expect(screen.getByText("Hydrogen")).toBeOnTheScreen();
    expect(screen.queryByText("H")).toBeNull();
  });

  it("reveals the back when the card is tapped", async () => {
    const onReveal = jest.fn();
    await render(
      <SwipeCard
        front="H"
        back="Hydrogen"
        revealed={false}
        onReveal={onReveal}
        onGrade={() => {}}
      />,
    );

    await fireEvent.press(screen.getByText("H"));

    expect(onReveal).toHaveBeenCalledTimes(1);
  });

  it("does nothing when tapped after being revealed", async () => {
    const onReveal = jest.fn();
    await render(
      <SwipeCard
        front="H"
        back="Hydrogen"
        revealed={true}
        onReveal={onReveal}
        onGrade={() => {}}
      />,
    );

    await fireEvent.press(screen.getByText("Hydrogen"));

    expect(onReveal).not.toHaveBeenCalled();
  });
});
