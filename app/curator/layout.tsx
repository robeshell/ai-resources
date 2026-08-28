import type { Metadata } from "next";
import { CuratorChrome } from "@/components/curator/CuratorChrome";

export const metadata: Metadata = {
  title: "Curator",
  description: "Local management studio for AI Nav.",
  robots: { index: false, follow: false },
};

export default function CuratorLayout({ children }: { children: React.ReactNode }) {
  return <CuratorChrome>{children}</CuratorChrome>;
}
