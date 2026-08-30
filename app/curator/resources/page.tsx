import { Suspense } from "react";
import { ResourceLibrary } from "@/components/curator/ResourceLibrary";

export default function CuratorResourcesPage() {
  return (
    <Suspense fallback={<section className="curator-page"><div className="curator-empty-state">正在读取资源库…</div></section>}>
      <ResourceLibrary />
    </Suspense>
  );
}
