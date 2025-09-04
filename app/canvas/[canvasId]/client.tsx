"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CanvasView } from "@/components/Canvas/CanvasView";
import { createClient } from "@/lib/supabase/client";

interface CanvasClientProps {
  canvasId: string;
}

export default function CanvasClient({ canvasId }: CanvasClientProps) {
  const router = useRouter();
  const [canvas, setCanvas] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCanvas = async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('canvases')
          .select('*')
          .eq('id', canvasId)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Canvas not found');

        setCanvas(data);
      } catch (err) {
        console.error('Error fetching canvas:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch canvas');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCanvas();
  }, [canvasId]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
            className="px-4 py-2 bg-blue-600 text-primary-foreground rounded-lg hover:bg-blue-700"
          >
            대시보드로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return <CanvasView canvas={canvas} />;
}