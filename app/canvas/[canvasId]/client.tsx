"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/queryClient";
import { CanvasView } from "@/components/Canvas/CanvasView";
import type { Canvas } from "@shared/schema";

interface CanvasClientProps {
  canvasId: string;
}

export default function CanvasClient({ canvasId }: CanvasClientProps) {
  const router = useRouter();

  const { data: canvas, isLoading, error } = useQuery<Canvas>({
    queryKey: ["/api/canvases", canvasId],
    queryFn: () => apiRequest("GET", `/api/canvases/${canvasId}`),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !canvas) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            캔버스를 찾을 수 없습니다
          </h2>
          <p className="text-gray-600 mb-4">
            요청하신 캔버스가 존재하지 않거나 접근 권한이 없습니다.
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return <CanvasView canvas={canvas} />;
}