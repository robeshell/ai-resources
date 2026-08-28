"use client";

import { useState } from "react";
import { logoCandidates } from "@/lib/logo";
import type { Tool } from "@/lib/types";

export function ToolLogo({
  tool,
  size = 36,
}: {
  tool: Tool;
  size?: number;
}) {
  const sources = logoCandidates(tool);
  const [index, setIndex] = useState(0);
  const src = sources[index];
  const showFallback = !src;
  const fallback = tool.name.replace(/[^A-Za-z0-9\u4e00-\u9fff]/g, "").slice(0, 2).toUpperCase();

  return (
    <span className="logo-frame" style={{ width: size, height: size }}>
      <span className={`logo-fallback${showFallback ? "" : " is-hidden"}`} aria-hidden="true">
        {fallback}
      </span>
      {src ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            src={src}
            width={size}
            height={size}
            loading="eager"
            onError={() => {
              setIndex((current) => current + 1);
            }}
          />
        </>
      ) : null}
    </span>
  );
}
