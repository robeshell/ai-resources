"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Box, Button, Skeleton, Stack, Text, Title } from "@mantine/core";
import { ConversationPanel } from "@/components/curator/ConversationPanel";
import { curatorRequest } from "@/lib/curator-client";
import { curatorEditorHref } from "@/lib/curator-routes";

export function CuratorStudio() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryConversationId = searchParams.get("conversation") || undefined;
  const resumeRunId = searchParams.get("resume") || undefined;
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
    <header className="curator-page-heading is-compact">
      <div>
        <Text className="curator-eyebrow-mantine">{conversationId || resumeRunId ? "继续收录" : "新收录"}</Text>
        <Title order={1} mt={4}>{conversationId || resumeRunId ? "接着上次的整理" : "整理一条资源"}</Title>
      </div>
    </header>

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
          hint="丢一个链接给 Agent，它自己访问页面、对照目录、写好草稿；你看完没问题就保存落库。"
          onSaved={(saved) => router.push(curatorEditorHref(saved.blockType, saved.slug))}
        />
      )}
      <Box>
        {conversationId ? (
          <Button component="a" href="/curator/ingest/" variant="subtle" color="gray" size="xs" px={0}>
            开一段新的收录
          </Button>
        ) : (
          <Button component="a" href="/curator/resources/" variant="subtle" color="gray" size="xs" px={0}>
            或者去资源库手动新建
          </Button>
        )}
      </Box>
    </div>
  </section>;
}
