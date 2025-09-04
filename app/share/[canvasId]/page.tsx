import ReadOnlyCanvasClient from "./client";

interface SharePageProps {
  params: Promise<{
    canvasId: string;
  }>;
}

export default async function SharePage({ params }: SharePageProps) {
  const { canvasId } = await params;
  
  return <ReadOnlyCanvasClient canvasId={canvasId} />;
}