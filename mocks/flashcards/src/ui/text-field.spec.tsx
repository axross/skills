import { fireEvent, render, screen } from "@testing-library/react-native";

import { TextField } from "./text-field";

describe("TextField", () => {
  it("renders its label", async () => {
    await render(
      <TextField label="Email address" value="" onChangeText={() => {}} />,
    );

    expect(screen.getByText("Email address")).toBeOnTheScreen();
  });

  it("calls onChangeText as the user types", async () => {
    const onChangeText = jest.fn();
    await render(
      <TextField
        label="Email address"
        value=""
        onChangeText={onChangeText}
        testID="email"
      />,
    );

    await fireEvent.changeText(screen.getByTestId("email"), "a@b.com");

    expect(onChangeText).toHaveBeenCalledWith("a@b.com");
  });

  it("shows an error message when one is provided", async () => {
    await render(
      <TextField
        label="Email address"
        value=""
        onChangeText={() => {}}
        errorMessage="Enter a valid email address."
      />,
    );

    expect(screen.getByText("Enter a valid email address.")).toBeOnTheScreen();
  });

  it("shows no error message by default", async () => {
    await render(
      <TextField
        label="Email address"
        value=""
        onChangeText={() => {}}
        testID="email"
      />,
    );

    expect(screen.queryByTestId("email-error")).toBeNull();
  });
});
