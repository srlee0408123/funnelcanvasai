"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CanvasView } from "@/components/Canvas/CanvasView";
import { createClient } from "@/lib/supabase/client";

/**
 * CanvasClient - 캔버스와 최신 상태를 로드해 CanvasView에 전달
 * 
 * 주요 역할:
 * 1. 캔버스 메타데이터 로드
 * 2. 최신 캔버스 상태(/api/canvases/:id/state/latest) 로드 및 camelCase로 정규화
 * 3. CanvasView로 전달하여 초기 렌더 시 저장된 노드/엣지 표시
 * 
 * 핵심 특징:
 * - Supabase 클라이언트로 캔버스 로드, Next API로 상태 로드
 * - 최소 변경으로 기존 저장 로직(useCanvasSync)과 호환
 * 
 * 주의사항:
 * - 최신 상태는 최초 마운트 시 한 번만 로드(실시간 반영은 별도)
 */

interface CanvasClientProps {
  canvasId: string;
}

export default function CanvasClient({ canvasId }: CanvasClientProps) {
  const router = useRouter();
  const [canvas, setCanvas] = useState<any>(null);
  const [canvasState, setCanvasState] = useState<any | null>(null);
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

        // 최신 캔버스 상태 로드 (서버 API 경유)
        try {
          const res = await fetch(`/api/canvases/${canvasId}/state/latest`, {
            method: 'GET',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
          });
          if (res.ok) {
            const stateRow = await res.json();
            if (stateRow && stateRow.id) {
              // snake_case -> camelCase 매핑 (shared CanvasState 형태에 맞춤)
              const mapped = {
                id: stateRow.id,
                canvasId: stateRow.canvas_id,
                state: stateRow.state,
                userId: stateRow.user_id,
                createdAt: stateRow.created_at ? new Date(stateRow.created_at) : null,
              } as any;
              setCanvasState(mapped);
            } else {
              setCanvasState(null);
            }
          } else {
            setCanvasState(null);
          }
        } catch (e) {
          // 상태가 없거나 에러 시 무시하고 빈 상태 유지
          setCanvasState(null);
        }
      } catch (err) {
        console.error('Error fetching canvas:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch canvas');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCanvas();
  }, [canvasId]);

  // canvases 테이블 실시간 구독: 제목 등 메타 변경을 UI에 반영
  useEffect(() => {
    if (!canvasId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`canvases-meta-${canvasId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'canvases', filter: `id=eq.${canvasId}` },
        (payload) => {
          // payload.new가 있으면 최신 레코드를 사용
          const next = (payload as any)?.new || (payload as any)?.record;
          if (next) {
            setCanvas((prev: any) => ({ ...(prev || {}), ...next }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  return <CanvasView canvas={canvas} canvasState={canvasState || undefined} />;
}