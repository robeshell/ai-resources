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
    fontWeight: "500",
    sizes: {
      h1: { fontSize: "1.25rem", lineHeight: "1.4" },
      h2: { fontSize: "0.875rem", lineHeight: "1.5" },
      h3: { fontSize: "0.875rem", lineHeight: "1.5" },
      h4: { fontSize: "0.875rem", lineHeight: "1.5" },
      h5: { fontSize: "0.875rem", lineHeight: "1.5" },
      h6: { fontSize: "0.875rem", lineHeight: "1.5" },
    },
  },
  // Three text sizes; component size aliases still control padding and height.
  fontSizes: { xs: "0.75rem", sm: "0.875rem", md: "0.875rem", lg: "1.25rem", xl: "1.25rem" },
  fontWeights: { regular: "400", medium: "500", bold: "500" },
  radius: { xs: "0.1875rem", sm: "0.375rem", md: "0.5rem", lg: "0.75rem", xl: "1rem" },
  defaultRadius: "sm",
  cursorType: "pointer",
  focusRing: "auto",
  components: {
    Button: { defaultProps: { size: "sm", radius: "sm" } },
    TextInput: { defaultProps: { size: "sm", radius: "sm" } },
    Textarea: { defaultProps: { size: "sm", radius: "sm", autosize: false } },
    Select: { defaultProps: { size: "sm", radius: "sm", allowDeselect: false } },
    Checkbox: { defaultProps: { size: "sm", radius: "sm" } },
    Paper: { defaultProps: { radius: "sm" } },
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
