import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import WorkspaceClient from "./client";

interface WorkspacePageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }
  
  const { workspaceId } = await params;
  
  return <WorkspaceClient workspaceId={workspaceId} userId={userId} />;
}