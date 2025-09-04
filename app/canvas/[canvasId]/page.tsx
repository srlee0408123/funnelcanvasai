import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import CanvasClient from "./client";

interface CanvasPageProps {
  params: Promise<{
    canvasId: string;
  }>;
}

export default async function CanvasPage({ params }: CanvasPageProps) {
  const { userId } = await auth();
  
  if (!userId) {
    redirect("/sign-in");
  }
  
  const { canvasId } = await params;
  
  return <CanvasClient canvasId={canvasId} />;
}