"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { logoCandidates } from "@/lib/logo";

function markFor(name: string) {
  return name.replace(/[^A-Za-z0-9\u4e00-\u9fff]/g, "").slice(0, 2).toUpperCase();
}

export function ToolLogo({
  tool,
  size = 36,
}: {
  tool: { id?: string; name: string; logo?: string; [key: string]: unknown };
  size?: number;
}) {
  const src = logoCandidates(tool)[0];
  return <LogoFace key={`${tool.id ?? tool.name}:${src ?? ""}`} src={src} name={tool.name} size={size} />;
}

function LogoFace({
  src,
  name,
  size,
}: {
  src?: string;
  name: string;
  size: number;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img?.complete) return;
    if (img.naturalWidth > 0) setReady(true);
    else setFailed(true);
  }, [src]);

  return (
    <span className="logo-frame" style={{ width: size, height: size }}>
      <span className={`logo-fallback${src && ready && !failed ? " is-hidden" : ""}`} aria-hidden="true">
        {markFor(name)}
      </span>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={imgRef}
          alt=""
          src={src}
          width={size}
          height={size}
          loading="eager"
          style={{ opacity: ready ? 1 : 0 }}
          onLoad={() => setReady(true)}
          onError={() => setFailed(true)}
        />
      ) : null}
    </span>
  );
}
