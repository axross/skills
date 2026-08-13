import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { StyleSheet } from "react-native-unistyles";

import { ActionButton } from "./action-button";

type ScreenHeaderProps = {
  title: string;
  onBack?: () => void;
  right?: ReactNode;
};

/**
 * The title row every non-entry screen renders below its safe area: an
 * optional back action on the left, the title centred, and an optional
 * action (e.g. a settings link) on the right. Centralising it keeps the
 * back affordance and its focus ring consistent everywhere it appears.
 */
export function ScreenHeader({ title, onBack, right }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.side}>
        {onBack ? (
          <ActionButton
            label="Back"
            kind="secondary"
            onPress={onBack}
            testID="screen-header-back"
          />
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <View style={[styles.side, styles.rightSide]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing(1),
  },
  side: {
    minWidth: theme.sizing.minTouchTarget,
  },
  rightSide: {
    alignItems: "flex-end",
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text,
    flex: 1,
    textAlign: "center",
  },
}));
