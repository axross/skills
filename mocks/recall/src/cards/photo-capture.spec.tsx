import { fireEvent, render, screen } from "@testing-library/react-native";
import type { PermissionResponse } from "expo-camera";

import { PhotoCapture } from "./photo-capture";

// The guidance is explicit: never render a real CameraView in a test.
// Stubbing it here lets every permission branch render safely.
jest.mock("expo-camera", () => ({
  CameraView: () => null,
}));

const GRANTED = {
  status: "granted",
  granted: true,
  canAskAgain: true,
  expires: "never",
} as PermissionResponse;

const DENIED_ASKABLE = {
  status: "denied",
  granted: false,
  canAskAgain: true,
  expires: "never",
} as PermissionResponse;

const DENIED_PERMANENTLY = {
  status: "denied",
  granted: false,
  canAskAgain: false,
  expires: "never",
} as PermissionResponse;

const noop = () => {};

describe("PhotoCapture", () => {
  it("shows a loading state while the permission is still resolving", async () => {
    await render(
      <PhotoCapture
        permission={null}
        onRequestPermission={noop}
        onOpenSettings={noop}
        onCapture={noop}
        onClear={noop}
      />,
    );

    expect(screen.getByTestId("photo-capture-loading")).toBeOnTheScreen();
  });

  it("offers to take a photo once permission is granted", async () => {
    await render(
      <PhotoCapture
        permission={GRANTED}
        onRequestPermission={noop}
        onOpenSettings={noop}
        onCapture={noop}
        onClear={noop}
      />,
    );

    expect(screen.getByTestId("capture-photo")).toBeOnTheScreen();
  });

  it("offers to ask again when permission is deniable", async () => {
    const onRequestPermission = jest.fn();
    await render(
      <PhotoCapture
        permission={DENIED_ASKABLE}
        onRequestPermission={onRequestPermission}
        onOpenSettings={noop}
        onCapture={noop}
        onClear={noop}
      />,
    );

    await fireEvent.press(screen.getByTestId("request-camera-permission"));

    expect(onRequestPermission).toHaveBeenCalledTimes(1);
  });

  it("sends the user to system settings when permission is permanently denied", async () => {
    const onOpenSettings = jest.fn();
    await render(
      <PhotoCapture
        permission={DENIED_PERMANENTLY}
        onRequestPermission={noop}
        onOpenSettings={onOpenSettings}
        onCapture={noop}
        onClear={noop}
      />,
    );

    await fireEvent.press(screen.getByTestId("open-settings"));

    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });

  it("shows the captured photo instead of the camera, and clears it on request", async () => {
    const onClear = jest.fn();
    await render(
      <PhotoCapture
        permission={GRANTED}
        photoUri="file://existing.jpg"
        onRequestPermission={noop}
        onOpenSettings={noop}
        onCapture={noop}
        onClear={onClear}
      />,
    );

    expect(screen.getByTestId("photo-preview")).toBeOnTheScreen();
    expect(screen.queryByTestId("capture-photo")).toBeNull();

    await fireEvent.press(screen.getByTestId("clear-photo"));

    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("shows an unavailable placeholder and a way to retake it if the photo fails to load", async () => {
    const onClear = jest.fn();
    await render(
      <PhotoCapture
        permission={GRANTED}
        photoUri="file://reclaimed.jpg"
        onRequestPermission={noop}
        onOpenSettings={noop}
        onCapture={noop}
        onClear={onClear}
      />,
    );

    await fireEvent(screen.getByTestId("photo-preview"), "error");

    expect(screen.getByTestId("photo-unavailable")).toBeOnTheScreen();
    expect(screen.queryByTestId("photo-preview")).toBeNull();

    await fireEvent.press(screen.getByTestId("retake-photo"));

    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
