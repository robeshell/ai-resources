"use client";

import { useEffect, useState } from "react";
import { curatorRequest, type BuildJob } from "@/lib/curator-client";

/**
 * Single implementation of the "poll /build while a build is running"
 * behavior shared by the Curator shell, dashboard and system panel.
 */
export function useBuildJob(initial: BuildJob = { status: "idle" }) {
  const [build, setBuild] = useState<BuildJob>(initial);

  useEffect(() => {
    if (build.status !== "running") return;
    const timer = window.setInterval(() => {
      curatorRequest<BuildJob>("/build").then(setBuild).catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [build.status]);

  return { build, setBuild };
}
