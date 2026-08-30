import { Suspense } from "react";
import { CuratorStudio } from "@/components/CuratorStudio";

export default function CuratorIngestPage() {
  return (
    <Suspense fallback={<section className="curator-page"><div className="curator-empty-state">正在连接 Curator…</div></section>}>
      <CuratorStudio />
    </Suspense>
  );
}
