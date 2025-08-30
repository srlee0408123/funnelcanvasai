import ReadOnlyCanvasClient from "./client";

interface SharePageProps {
  params: {
    canvasId: string;
  };
}

export default function SharePage({ params }: SharePageProps) {
  return <ReadOnlyCanvasClient canvasId={params.canvasId} />;
}