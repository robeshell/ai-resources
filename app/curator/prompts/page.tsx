import { redirect } from "next/navigation";

export default function CuratorPromptsPage() {
  redirect("/curator/resources/?block=prompt");
}
