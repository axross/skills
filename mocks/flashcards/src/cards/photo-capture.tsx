import { useRef } from "react";
import { CameraView, type PermissionResponse } from "expo-camera";
import { Image, Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { ActionButton } from "@/ui/action-button";

type PhotoCaptureProps = {
  /** `null` while the current permission status is still being read. */
  permission: PermissionResponse | null;
  photoUri?: string;
  onRequestPermission: () => void;
  onOpenSettings: () => void;
  onCapture: (uri: string) => void;
  onClear: () => void;
};

/**
 * The add-card screen's optional photo. Branches on every camera-permission
 * state — still resolving, granted, deniable, and permanently denied — and
 * only ever asks for the permission when the learner taps "Allow camera
 * access", never on mount.
 */
export function PhotoCapture({
  permission,
  photoUri,
  onRequestPermission,
  onOpenSettings,
  onCapture,
  onClear,
}: PhotoCaptureProps) {
  const cameraRef = useRef<CameraView>(null);

  async function capture() {
    const photo = await cameraRef.current?.takePictureAsync();
    if (photo?.uri) {
      onCapture(photo.uri);
    }
  }

  if (photoUri) {
    return (
      <View style={styles.container}>
        <Image
          source={{ uri: photoUri }}
          style={styles.preview}
          testID="photo-preview"
        />
        <ActionButton
          label="Remove photo"
          kind="secondary"
          onPress={onClear}
          testID="clear-photo"
        />
      </View>
    );
  }

  if (permission === null) {
    return (
      <View style={styles.container} testID="photo-capture-loading">
        <Text style={styles.hint}>Checking camera access…</Text>
      </View>
    );
  }

  if (permission.granted) {
    return (
      <View style={styles.container}>
        <CameraView ref={cameraRef} style={styles.camera} facing="back" />
        <ActionButton
          label="Take photo"
          onPress={capture}
          testID="capture-photo"
        />
      </View>
    );
  }

  if (permission.canAskAgain) {
    return (
      <View style={styles.container}>
        <Text style={styles.hint}>Recall can attach a photo to this card.</Text>
        <ActionButton
          label="Allow camera access"
          onPress={onRequestPermission}
          testID="request-camera-permission"
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.hint}>
        Camera access is off. Turn it on in system settings to add a photo.
      </Text>
      <ActionButton
        label="Open settings"
        kind="secondary"
        onPress={onOpenSettings}
        testID="open-settings"
      />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.spacing(1.5),
  },
  camera: {
    height: theme.sizing.mediaHeight,
    borderRadius: theme.radius.md,
    overflow: "hidden",
  },
  preview: {
    height: theme.sizing.mediaHeight,
    borderRadius: theme.radius.md,
  },
  hint: {
    ...theme.typography.body,
    color: theme.colors.textMuted,
  },
}));
