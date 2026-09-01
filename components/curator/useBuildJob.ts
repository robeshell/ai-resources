"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { curatorRequest, type BuildJob } from "@/lib/curator-client";

/**
 * Single implementation of the "poll /build while a build is running"
 * behavior shared by the Curator shell, dashboard and system panel.
 */
type BuildJobContextValue = {
  build: BuildJob;
  setBuild: (build: BuildJob) => void;
};

const BuildJobContext = createContext<BuildJobContextValue | null>(null);

export function BuildJobProvider({ children }: { children: ReactNode }) {
  const [build, setBuildState] = useState<BuildJob>({ status: "idle" });
  const setBuild = useCallback((next: BuildJob) => setBuildState(next), []);

  useEffect(() => {
    if (build.status !== "running") return;
    const timer = window.setInterval(() => {
      curatorRequest<BuildJob>("/build").then(setBuild).catch(() => undefined);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [build.status, setBuild]);

  const value = useMemo(() => ({ build, setBuild }), [build, setBuild]);
  return createElement(BuildJobContext.Provider, { value }, children);
}

export function useBuildJob() {
  const value = useContext(BuildJobContext);
  if (!value) throw new Error("useBuildJob 必须在 BuildJobProvider 内使用");
  return value;
}
