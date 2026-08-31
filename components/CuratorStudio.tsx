"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Box, Button, Text, Title } from "@mantine/core";
import { ConversationPanel } from "@/components/curator/ConversationPanel";
import { curatorEditorHref } from "@/lib/curator-routes";

export function CuratorStudio() {
  const router = useRouter();
  // Resuming a failed ingest from the workbench reopens that exact
  // conversation, with its history and its retry action, instead of dropping
  // the operator into a blank new one.
  const conversationId = useSearchParams().get("conversation") || undefined;

  return <section className="curator-page">
    <header className="curator-page-heading is-compact">
      <div>
        <Text className="curator-eyebrow-mantine">{conversationId ? "继续收录" : "新收录"}</Text>
        <Title order={1} mt={4}>{conversationId ? "接着上次的整理" : "整理一条资源"}</Title>
      </div>
    </header>

    <div className="curator-ingest-conversation">
      <ConversationPanel
        key={conversationId || "new"}
        conversationId={conversationId}
        hint="丢一个链接给 Agent，它自己访问页面、对照目录、写好草稿；你看完没问题就保存落库。"
        onSaved={(saved) => router.push(curatorEditorHref(saved.blockType, saved.slug))}
      />
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
