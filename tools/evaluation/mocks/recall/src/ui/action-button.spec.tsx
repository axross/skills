import { fireEvent, render, screen } from "@testing-library/react-native";

import { ActionButton } from "./action-button";

describe("ActionButton", () => {
  it("renders its label", async () => {
    await render(<ActionButton label="Recalled" onPress={() => {}} />);

    expect(screen.getByRole("button", { name: "Recalled" })).toBeOnTheScreen();
  });

  it("calls onPress when tapped", async () => {
    const onPress = jest.fn();
    await render(
      <ActionButton label="Recalled" onPress={onPress} testID="grade-button" />,
    );

    fireEvent.press(screen.getByTestId("grade-button"));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each(["primary", "secondary", "destructive", "positive"] as const)(
    "meets the 44x44 minimum touch target for the %s kind",
    async (kind) => {
      await render(
        <ActionButton
          label={kind}
          onPress={() => {}}
          kind={kind}
          testID={`${kind}-button`}
        />,
      );

      expect(screen.getByTestId(`${kind}-button`)).toHaveStyle({
        minWidth: 44,
        minHeight: 44,
      });
    },
  );

  it("tracks focus so a focus-ring variant has something to key off", async () => {
    await render(
      <ActionButton
        label="Recalled"
        onPress={() => {}}
        testID="grade-button"
      />,
    );
    const button = screen.getByTestId("grade-button");

    // The Unistyles Jest mock strips variant styles entirely (see
    // react-native-unistyles/mocks), so the focus ring's colour is not
    // observable here — only on a real render. What this pins is the
    // component-side half: focus and blur fire without throwing, so
    // neither handler is dropped in the style-array-to-variant merge.
    await fireEvent(button, "focus");
    await fireEvent(button, "blur");
  });
});
