"use client";

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CanvasView } from "@/components/Canvas/CanvasView";
import type { Canvas } from "@shared/schema";

interface ReadOnlyCanvasClientProps {
  canvasId: string;
}

type CanvasForView = Canvas & { workspace_id?: string; created_by?: string; is_public?: boolean };

export default function ReadOnlyCanvasClient({ canvasId }: ReadOnlyCanvasClientProps) {
  const { data: canvas, isLoading, error } = useQuery<CanvasForView>({
    queryKey: ["/api/canvases", canvasId, "public"],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/canvases/${canvasId}`);
      return (await res.json()) as CanvasForView;
    },
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
          <p className="text-gray-600">
            요청하신 캔버스가 존재하지 않거나 공개되지 않았습니다.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 text-center">
        <span className="text-yellow-800 text-sm">
          읽기 전용 모드입니다. 수정할 수 없습니다.
        </span>
      </div>
      <CanvasView canvas={canvas as any} readOnly />
    </div>
  );
}
