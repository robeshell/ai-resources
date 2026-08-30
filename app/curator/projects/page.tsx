import { redirect } from "next/navigation";

export default function CuratorProjectsPage() {
  redirect("/curator/resources/?block=project");
}
