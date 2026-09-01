"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Box, Button, Skeleton, Stack, Text } from "@mantine/core";
import { ConversationPanel } from "@/components/curator/ConversationPanel";
import { curatorRequest } from "@/lib/curator-client";
import type { CuratorIngestBlock } from "@/lib/curator-client";
import { curatorEditorHref } from "@/lib/curator-routes";
import { CuratorPageHeader } from "@/components/curator/CuratorPageHeader";

export function CuratorStudio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryConversationId = searchParams.get("conversation") || undefined;
  const resumeRunId = searchParams.get("resume") || undefined;
  const requestedBlock = searchParams.get("block");
  const block = (["tool", "skill", "project", "prompt"] as const).includes(requestedBlock as CuratorIngestBlock)
    ? requestedBlock as CuratorIngestBlock
    : undefined;
  const [conversationId, setConversationId] = useState(queryConversationId);
  const [resumeError, setResumeError] = useState("");
  const isResuming = Boolean(resumeRunId && !conversationId && !resumeError);

  useEffect(() => {
    if (!resumeRunId || queryConversationId) return;
    let active = true;
    curatorRequest<{ id: string }>(`/runs/${encodeURIComponent(resumeRunId)}/resume`, { method: "POST" })
      .then((conversation) => {
        if (!active) return;
        setConversationId(conversation.id);
        router.replace(`/curator/ingest/?conversation=${encodeURIComponent(conversation.id)}`);
      })
      .catch((error) => {
        if (active) setResumeError(error instanceof Error ? error.message : "恢复这次收录失败");
      });
    return () => { active = false; };
  }, [queryConversationId, resumeRunId, router]);

  return <section className="curator-page">
    <CuratorPageHeader title={conversationId || resumeRunId ? "继续收录" : "收录资源"} description={conversationId || resumeRunId ? "接着处理上一次未完成的内容。" : "提交链接或说明，让 Agent 生成可检查的草稿。"} />

    <div className="curator-ingest-conversation">
      {isResuming ? (
        <Stack gap="sm" py="md">
          <Skeleton h={88} radius="md" />
          <Skeleton h={148} radius="md" />
          <Text size="sm" c="dimmed">正在恢复上一次的链接、备注和失败记录…</Text>
        </Stack>
      ) : resumeError ? (
        <Alert color="red" title="无法恢复这次收录">{resumeError}</Alert>
      ) : (
        <ConversationPanel
          key={conversationId || "new"}
          conversationId={conversationId}
          ingestBlock={block}
          hint="丢一个链接，它会读取页面、对照目录并生成草稿；确认后再保存。"
          onSaved={(saved) => router.push(curatorEditorHref(saved.blockType, saved.slug))}
        />
      )}
      <Box>
        {conversationId ? (
          <Button component="a" href="/curator/ingest/" variant="subtle" color="gray" size="xs" px={0}>
            开一段新的收录
          </Button>
        ) : null}
      </Box>
    </div>
  </section>;
}
