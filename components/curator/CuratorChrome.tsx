"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, Burger, Drawer, Popover } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { BrandMark } from "@/components/BrandMark";
import { AccentPicker } from "@/components/AccentPicker";
import { curatorRequest, type BuildJob } from "@/lib/curator-client";
import { useBuildJob } from "@/components/curator/useBuildJob";

const links = [
  { href: "/curator/", label: "工作台", match: ["/curator/"] },
  { href: "/curator/resources/", label: "资源库", match: ["/curator/resources/", "/curator/editor/", "/curator/skills/", "/curator/projects/", "/curator/prompts/"] },
  { href: "/curator/ingest/", label: "收录资源", match: ["/curator/ingest/"] },
  { href: "/curator/settings/", label: "系统设置", match: ["/curator/settings/"] },
];

function pathMatches(pathname: string, link: (typeof links)[number]) {
  const current = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return link.match.some((prefix) => prefix === "/curator/" ? current === prefix : current.startsWith(prefix));
}

export function CuratorChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/curator/";
  const [service, setService] = useState<"checking" | "online" | "offline">("checking");
  const { build, setBuild } = useBuildJob();
  const [menuOpen, { open: openMenu, close: closeMenu }] = useDisclosure(false);

  useEffect(() => {
    let active = true;
    curatorRequest<{ ok: boolean; build?: BuildJob }>("/health")
      .then((payload) => {
        if (!active) return;
        setService("online");
        if (payload.build) setBuild(payload.build);
      })
      .catch(() => { if (active) setService("offline"); });
    return () => { active = false; };
  }, [setBuild]);

  const navigation = <nav className="curator-sidebar-nav" aria-label="工作区导航">
    {links.map((link) => <Link key={link.href} href={link.href} className="curator-sidebar-link"
      aria-current={pathMatches(pathname, link) ? "page" : undefined} onClick={closeMenu}>
      {link.label}
    </Link>)}
  </nav>;

  return <div className="curator-root curator-workspace">
    <a className="curator-skip" href="#curator-main">跳到工作区</a>
    <aside className="curator-sidebar">
      <Link href="/curator/" className="curator-sidebar-brand"><BrandMark size={28} /><span>AI 资源集<small>内容工作台</small></span></Link>
      {navigation}
      <div className="curator-sidebar-footer">
        <Link href="/zh/" className="curator-sidebar-utility">查看公开站 <span aria-hidden="true">↗</span></Link>
        <Popover position="right-end" shadow="sm" width={180}>
          <Popover.Target><button type="button" className="curator-sidebar-utility">外观设置 <span aria-hidden="true">◐</span></button></Popover.Target>
          <Popover.Dropdown><span className="curator-appearance-label">主题色</span><AccentPicker locale="zh" /></Popover.Dropdown>
        </Popover>
        <div className="curator-service" data-state={service} role="status"><i aria-hidden="true" />{service === "online" ? "本地服务已连接" : service === "offline" ? "本地服务未启动" : "正在连接服务"}</div>
        {build.status === "running" ? <span className="curator-service">构建校验中…</span> : null}
      </div>
    </aside>
    <header className="curator-mobile-header"><Link href="/curator/" className="curator-sidebar-brand"><BrandMark size={26} /><span>内容工作台</span></Link><Burger opened={menuOpen} onClick={menuOpen ? closeMenu : openMenu} size="sm" aria-label="菜单" /></header>
    <Drawer opened={menuOpen} onClose={closeMenu} title="内容工作台" position="left" size="xs">
      {navigation}<Link href="/zh/" className="curator-sidebar-utility">查看公开站 ↗</Link>
    </Drawer>
    <main id="curator-main" tabIndex={-1} className="curator-workspace-main">
      {service === "offline" ? <Alert color="yellow" title="Curator 服务未启动" role="status" mb="md">运行 <code>npm run curator</code> 后重试。</Alert> : null}
      <div className="curator-page-container">{children}</div>
    </main>
  </div>;
}
