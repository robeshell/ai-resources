"use client";

import { Alert, Button, Stack } from "@mantine/core";
import { useSearchParams } from "next/navigation";
import { ContentEditor } from "@/components/curator/ContentEditor";
import { isEnabledContentBlockId } from "@/lib/content-blocks";

export function CuratorEditorRoute() {
  const searchParams = useSearchParams();
  const block = searchParams.get("block");
  const slug = searchParams.get("slug");

  if (!block || !isEnabledContentBlockId(block) || !slug) {
    return <Stack gap="md">
      <Alert color="red" title="编辑地址不完整">缺少有效的内容类型或 slug，无法打开编辑器。</Alert>
      <Button component="a" href="/curator/resources/" variant="default" w="fit-content">返回资源库</Button>
    </Stack>;
  }

  return <ContentEditor key={`${block}:${slug}`} block={block} slug={slug} />;
}
