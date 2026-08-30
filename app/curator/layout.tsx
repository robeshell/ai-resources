import type { Metadata } from "next";
import { CuratorChrome } from "@/components/curator/CuratorChrome";
import { CuratorProvider } from "@/components/curator/CuratorProvider";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./curator.css";

export const metadata: Metadata = {
  title: "Curator",
  description: "Local management studio for AI Nav.",
  robots: { index: false, follow: false },
};

export default function CuratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <CuratorProvider>
      <CuratorChrome>{children}</CuratorChrome>
    </CuratorProvider>
  );
}
