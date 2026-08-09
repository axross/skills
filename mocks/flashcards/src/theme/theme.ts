import { StyleSheet } from "react-native-unistyles";

const typography = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "700" },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700" },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400" },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "600" },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
} as const;

const radius = {
  sm: 8,
  md: 12,
  lg: 20,
} as const;

const spacing = (steps: number) => steps * 8;

const sizing = {
  /**
   * The height of a full-bleed media surface: the study card's face and the
   * add-card screen's camera preview and photo thumbnail all share it, so a
   * future one has a value to match rather than a new number to invent.
   */
  mediaHeight: 220,
} as const;

const shared = {
  typography,
  radius,
  spacing,
  sizing,
} as const;

const light = {
  ...shared,
  colors: {
    background: "#f7f8fa",
    surface: "#ffffff",
    text: "#1b1f24",
    textMuted: "#5a6472",
    accent: "#3a49c9",
    onAccent: "#ffffff",
    positive: "#1f7a4d",
    negative: "#b3271e",
    border: "#767e8a",
    focusRing: "#3a49c9",
  },
} as const;

const dark = {
  ...shared,
  colors: {
    background: "#0f1216",
    surface: "#171b21",
    text: "#e8ecf1",
    textMuted: "#9aa5b4",
    accent: "#9fb0ff",
    onAccent: "#0f1216",
    positive: "#63d19a",
    negative: "#ff9a92",
    border: "#6c7684",
    focusRing: "#9fb0ff",
  },
} as const;

const themes = { light, dark };

type AppThemes = typeof themes;

declare module "react-native-unistyles" {
  // Interface merging is how Unistyles' own types pick up this app's theme
  // shape; an empty body is expected here, not a mistake.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export interface UnistylesThemes extends AppThemes {}
}

StyleSheet.configure({
  settings: { adaptiveThemes: true },
  themes,
});
