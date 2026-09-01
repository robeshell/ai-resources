"use client";

import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { BuildJobProvider } from "@/components/curator/useBuildJob";

const curatorTheme = createTheme({
  primaryColor: "curator",
  primaryShade: 7,
  colors: {
    curator: [
      "#fff2e8",
      "#fde4d4",
      "#fac5a5",
      "#f2a06f",
      "#e77a3f",
      "#d96222",
      "#ce5214",
      "#ad4210",
      "#7a3a12",
      "#5a2a0c",
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
  defaultRadius: "sm",
  cursorType: "pointer",
  focusRing: "auto",
  components: {
    Button: { defaultProps: { size: "sm", radius: "sm" } },
    TextInput: { defaultProps: { size: "md", radius: "sm" } },
    Textarea: { defaultProps: { size: "md", radius: "sm", autosize: false } },
    Select: { defaultProps: { size: "md", radius: "sm", allowDeselect: false } },
    Checkbox: { defaultProps: { size: "sm", radius: "sm" } },
    Paper: { defaultProps: { radius: "md" } },
  },
});

export function CuratorProvider({ children }: { children: React.ReactNode }) {
  return (
    <MantineProvider theme={curatorTheme} forceColorScheme="light">
      <Notifications position="top-right" limit={3} autoClose={3600} />
      <BuildJobProvider>{children}</BuildJobProvider>
    </MantineProvider>
  );
}
