import { Suspense } from "react";
import { Skeleton, Stack } from "@mantine/core";
import { CuratorEditorRoute } from "@/components/curator/CuratorEditorRoute";

function EditorFallback() {
  return <Stack gap="md"><Skeleton h={42} w="35%" /><Skeleton h={260} /><Skeleton h={340} /></Stack>;
}

export default function CuratorEditorPage() {
  return <Suspense fallback={<EditorFallback />}><CuratorEditorRoute /></Suspense>;
}
