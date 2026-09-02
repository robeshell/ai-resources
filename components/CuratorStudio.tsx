"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, SegmentedControl, Skeleton, Stack, Text } from "@mantine/core";
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
  const initialBlock = (["tool", "skill", "project", "site", "prompt"] as const).includes(requestedBlock as CuratorIngestBlock)
    ? requestedBlock as CuratorIngestBlock
    : undefined;
  const [block, setBlock] = useState<CuratorIngestBlock | undefined>(initialBlock);
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
    <CuratorPageHeader
      title={conversationId || resumeRunId ? "继续收录" : "收录资源"}
      description={conversationId || resumeRunId
        ? "接着处理上一次未完成的内容。"
        : block === "prompt" ? "粘贴提示词正文，检查 AI 整理结果，再保存到资源库。" : "提交来源，检查 Agent 整理的草稿，再保存到资源库。"}
      actions={conversationId ? <Button component="a" href="/curator/ingest/" variant="default">开始新收录</Button> : null}
    />

    <div className="curator-ingest-workspace">
      <div className="curator-ingest-typebar">
        <Text size="sm" fw={600}>内容类型</Text>
        <SegmentedControl
          aria-label="内容类型"
          value={block || "auto"}
          onChange={(value) => setBlock(value === "auto" ? undefined : value as CuratorIngestBlock)}
          data={[
            { value: "auto", label: "自动" },
            { value: "tool", label: "工具" },
            { value: "skill", label: "技能" },
            { value: "project", label: "项目" },
            { value: "site", label: "站点" },
            { value: "prompt", label: "提示词" },
          ]}
        />
      </div>
      {isResuming ? (
        <Stack gap="sm" py="xl" className="curator-ingest-loading">
          <Skeleton h={88} radius="md" />
          <Skeleton h={148} radius="md" />
          <Text size="sm" c="dimmed">正在恢复上一次的来源、消息和处理记录…</Text>
        </Stack>
      ) : resumeError ? (
        <Alert color="red" title="无法恢复这次收录">{resumeError}</Alert>
      ) : (
        <ConversationPanel
          key={`${conversationId || "new"}-${block || "auto"}`}
          conversationId={conversationId}
          ingestBlock={block}
          hint={block === "prompt"
            ? "直接粘贴提示词正文。来源链接可不填，AI 只负责整理成草稿。"
            : "丢一个链接，它会读取页面、对照目录并生成草稿；确认后再保存。"}
          onSaved={(saved) => router.push(curatorEditorHref(saved.blockType, saved.slug))}
        />
      )}
    </div>
  </section>;
}
