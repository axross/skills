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

  it("meets the 44x44 minimum touch target for every kind", async () => {
    for (const kind of ["primary", "secondary", "destructive"] as const) {
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
    }
  });
});
