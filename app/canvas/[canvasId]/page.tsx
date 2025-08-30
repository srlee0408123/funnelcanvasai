import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import CanvasClient from "./client";

interface CanvasPageProps {
  params: {
    canvasId: string;
  };
}

export default async function CanvasPage({ params }: CanvasPageProps) {
  const session = await getServerSession(authOptions);
  
  if (!session) {
    redirect("/");
  }
  
  return <CanvasClient canvasId={params.canvasId} />;
}