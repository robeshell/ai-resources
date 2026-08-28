"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { curatorRequest, type BuildJob } from "@/lib/curator-client";

const links = [
  { href: "/curator/", label: "总览" },
  { href: "/curator/resources/", label: "资源库" },
  { href: "/curator/ingest/", label: "收录" },
  { href: "/curator/inbox/", label: "模型清单" },
  { href: "/curator/scenarios/", label: "场景方案" },
  { href: "/curator/settings/", label: "设置" },
];

function pathMatches(pathname: string, href: string) {
  const current = pathname.endsWith("/") ? pathname : `${pathname}/`;
  if (href === "/curator/") return current === "/curator/";
  return current.startsWith(href);
}

export function CuratorChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/curator/";
  const [service, setService] = useState<"checking" | "online" | "offline">("checking");
  const [build, setBuild] = useState<BuildJob>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    curatorRequest<{ ok: boolean; build?: BuildJob }>("/health")
      .then((payload) => {
        setService("online");
        if (payload.build) setBuild(payload.build);
      })
      .catch(() => setService("offline"));
  }, []);

  useEffect(() => {
    if (build.status !== "running") return;
    const timer = setInterval(() => {
      curatorRequest<BuildJob>("/build").then(setBuild).catch(() => undefined);
    }, 1500);
    return () => clearInterval(timer);
  }, [build.status]);

  async function previewBuild() {
    setBusy(true);
    try {
      setBuild(await curatorRequest<BuildJob>("/build", { method: "POST" }));
    } catch {
      setBuild({ status: "error", error: "构建没有开始" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="curator-page">
      <header className="curator-header">
        <Link href="/zh/" className="brand" aria-label="返回 AI 导航">
          <BrandMark size={24} />
          <span>AI 导航</span>
        </Link>
        <nav className="curator-nav" aria-label="管理">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={pathMatches(pathname, link.href) ? "is-active" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="curator-header-actions">
          <div className="curator-service">
            <span className={`curator-service-dot is-${service}`} />
            {service === "online" ? "已连接" : service === "offline" ? "未启动" : "检查中"}
          </div>
          <button type="button" className="curator-preview-btn" onClick={previewBuild} disabled={busy || service !== "online" || build.status === "running"}>
            {build.status === "running" || busy ? "正在构建…" : "生成预览"}
          </button>
        </div>
      </header>
      {service === "offline" ? (
        <div className="curator-notice curator-notice-banner">
          在项目目录运行 <code>npm run curator</code>，然后刷新这个页面。
        </div>
      ) : null}
      {build.status === "ok" ? (
        <p className="curator-build-strip">
          预览已更新。
          <a href={build.previewUrl || "http://localhost:3000/zh/"} target="_blank" rel="noreferrer">打开首页 ↗</a>
        </p>
      ) : null}
      {build.status === "error" ? (
        <p className="curator-build-strip is-error">{build.error || "构建失败"}</p>
      ) : null}
      {children}
    </div>
  );
}
