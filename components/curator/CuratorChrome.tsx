"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AppShell, Badge, Box, Burger, Container, Drawer, Group, Stack, Text } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { BrandMark } from "@/components/BrandMark";
import { curatorRequest, type BuildJob } from "@/lib/curator-client";
import { useBuildJob } from "@/components/curator/useBuildJob";

const links = [
  { href: "/curator/", label: "工作台", match: ["/curator/"] },
  { href: "/curator/resources/", label: "资源库", match: ["/curator/resources/", "/curator/skills/", "/curator/projects/", "/curator/prompts/"] },
  { href: "/curator/ingest/", label: "收录", match: ["/curator/ingest/"] },
  { href: "/curator/settings/", label: "系统", match: ["/curator/settings/"] },
];

function pathMatches(pathname: string, link: (typeof links)[number]) {
  const current = pathname.endsWith("/") ? pathname : `${pathname}/`;
  return link.match.some((prefix) => (prefix === "/curator/" ? current === prefix : current.startsWith(prefix)));
}

export function CuratorChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/curator/";
  const [service, setService] = useState<"checking" | "online" | "offline">("checking");
  const { build, setBuild } = useBuildJob();
  const [menuOpen, { open: openMenu, close: closeMenu }] = useDisclosure(false);

  useEffect(() => {
    curatorRequest<{ ok: boolean; build?: BuildJob }>("/health")
      .then((payload) => {
        setService("online");
        if (payload.build) setBuild(payload.build);
      })
      .catch(() => setService("offline"));
  }, [setBuild]);

  return (
    <AppShell className="curator-root" header={{ height: 58 }} padding={0}>
      <AppShell.Header className="curator-header">
        <Container size="xl" className="curator-header-inner">
          <Group h="100%" justify="space-between" wrap="nowrap">
          <Group gap="xl" wrap="nowrap">
          <Link href="/zh/" className="curator-brand-link" aria-label="返回 AI 资源集">
            <Group gap="xs" wrap="nowrap"><BrandMark size={22} /><span>Curator</span></Group>
          </Link>
          <Group component="nav" aria-label="Curator" gap="xl" visibleFrom="sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="curator-nav-link"
                data-active={pathMatches(pathname, link)}
                aria-current={pathMatches(pathname, link) ? "page" : undefined}
              >
                {link.label}
              </Link>
            ))}
          </Group>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Badge color={service === "online" ? "teal" : service === "offline" ? "red" : "gray"} variant="light" size="sm" visibleFrom="sm">
              {service === "online" ? "服务正常" : service === "offline" ? "服务未启动" : "连接中"}
            </Badge>
            {build.status === "running" ? <Badge color="curator" variant="light" size="sm" visibleFrom="sm">构建校验中</Badge> : null}
            <Burger opened={menuOpen} onClick={menuOpen ? closeMenu : openMenu} hiddenFrom="sm" size="sm" aria-label="菜单" />
          </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <Drawer opened={menuOpen} onClose={closeMenu} title="Curator" position="right" size="xs" hiddenFrom="sm">
        <Stack component="nav" aria-label="Curator 移动导航" gap="xs">
          {links.map((link) => (
            <Box component={Link} key={link.href} href={link.href} className="curator-nav-link" data-active={pathMatches(pathname, link)} p="sm" onClick={closeMenu}>
              {link.label}
            </Box>
          ))}
          <Text size="sm" c={service === "online" ? "teal.8" : service === "offline" ? "red.7" : "dimmed"} mt="md">
            {service === "online" ? "服务正常" : service === "offline" ? "服务未启动" : "连接中"}
          </Text>
        </Stack>
      </Drawer>

      <AppShell.Main>
        {(service === "offline" || build.status === "error") ? <Container size="xl" className="curator-shell-alerts">
          {service === "offline" ? <Alert color="yellow" title="Curator 服务未启动" role="status">运行 <code>npm run curator</code> 后重试。</Alert> : null}
          {build.status === "error" ? <Alert color="red" title="构建校验失败" role="alert" mt="sm">{build.error || "构建没有完成"}</Alert> : null}
        </Container> : null}
        <Container component="div" size="xl" className="curator-main curator-page-container">{children}</Container>
      </AppShell.Main>
    </AppShell>
  );
}
