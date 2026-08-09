import { useState } from "react";
import { Text, TextInput, View, type TextInputProps } from "react-native";
import { StyleSheet } from "react-native-unistyles";

type TextFieldProps = Pick<
  TextInputProps,
  | "autoCapitalize"
  | "keyboardType"
  | "textContentType"
  | "multiline"
  | "placeholder"
> & {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  errorMessage?: string;
  testID?: string;
};

/**
 * The app's one labelled text input: a focus ring matching `ActionButton`'s,
 * a 44pt minimum height, and a visible error state driven by a variant
 * rather than a boolean style prop.
 */
export function TextField({
  label,
  value,
  onChangeText,
  errorMessage,
  testID,
  ...inputProps
}: TextFieldProps) {
  const [isFocused, setIsFocused] = useState(false);
  const hasError = Boolean(errorMessage);

  // `default` is Unistyles' reserved fallback key — passing `undefined`
  // selects it rather than naming it explicitly.
  styles.useVariants({
    state: hasError ? "error" : isFocused ? "focused" : undefined,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={styles.input}
        testID={testID}
        accessibilityLabel={label}
      />
      {hasError ? (
        <Text
          style={styles.error}
          testID={testID ? `${testID}-error` : undefined}
        >
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    gap: theme.spacing(0.5),
  },
  label: {
    ...theme.typography.label,
    color: theme.colors.text,
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.text,
    minHeight: 44,
    borderWidth: 2,
    borderRadius: theme.radius.sm,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing(1.5),
    variants: {
      state: {
        default: {},
        focused: { borderColor: theme.colors.focusRing },
        error: { borderColor: theme.colors.negative },
      },
    },
  },
  error: {
    ...theme.typography.caption,
    color: theme.colors.negative,
  },
}));
