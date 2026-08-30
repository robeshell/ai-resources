"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";

const curatorTheme = createTheme({
  primaryColor: "curator",
  primaryShade: 7,
  colors: {
    curator: [
      "#fff7f1",
      "#ffeadc",
      "#ffd1b5",
      "#fdb68b",
      "#f39562",
      "#e6763e",
      "#d55d25",
      "#b9481b",
      "#963b1b",
      "#7b331a",
    ],
  },
  fontFamily: "var(--font-plex-sans), system-ui, sans-serif",
  fontFamilyMonospace: "var(--font-plex-mono), ui-monospace, monospace",
  headings: {
    fontFamily: "var(--font-plex-sans), system-ui, sans-serif",
    fontWeight: "600",
    sizes: {
      h1: { fontSize: "2rem", lineHeight: "1.12" },
      h2: { fontSize: "1.125rem", lineHeight: "1.35" },
      h3: { fontSize: "1rem", lineHeight: "1.4" },
    },
  },
  defaultRadius: "md",
  cursorType: "pointer",
  focusRing: "auto",
  components: {
    Button: { defaultProps: { size: "sm", radius: "md" } },
    TextInput: { defaultProps: { size: "md", radius: "md" } },
    Textarea: { defaultProps: { size: "md", radius: "md", autosize: false } },
    Select: { defaultProps: { size: "md", radius: "md", allowDeselect: false } },
    Checkbox: { defaultProps: { size: "sm", radius: "sm" } },
    Paper: { defaultProps: { radius: "lg" } },
  },
});

export function CuratorProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={curatorTheme} forceColorScheme="light">
      <Notifications position="top-right" limit={3} />
      {children}
    </MantineProvider>
  );
}
