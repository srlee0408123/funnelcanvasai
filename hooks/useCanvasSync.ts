/**
 * useCanvasSync - 캔버스 상태 서버 동기화 훅 (디바운스 저장)
 * 
 * 주요 역할:
 * 1. Zustand 스토어의 nodes/edges/nodePositions 변화를 감지해 디바운스 저장
 * 2. 수동 저장(triggerSave) API 제공 (즉시 저장 옵션 포함)
 * 3. 실제 저장은 /api/canvases/:id/state 로 POST 수행
 * 
 * 핵심 특징:
 * - 변경 해시 비교로 불필요한 저장 방지
 * - 즉시/지연 저장 모두 지원
 * - React Query와 호환되는 구조(현재 fetch 직접 호출)
 * 
 * 주의사항:
 * - Text Memo는 별도의 엔드포인트를 사용하므로 기본 저장에는 포함하지 않음
 * - 메모 등 추가 필드를 저장하려면 payloadBuilder 옵션 사용
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useCanvasStore } from '@/hooks/useCanvasStore';

type SavePayload = {
  nodes: any[];
  edges: any[];
  [key: string]: any;
};

interface UseCanvasSyncOptions {
  debounceMs?: number;
  payloadBuilder?: (base: { nodes: any[]; edges: any[] }) => SavePayload;
  onSuccess?: () => void;
  onError?: (error: unknown) => void;
}

export function useCanvasSync(canvasId: string, options: UseCanvasSyncOptions = {}) {
  const { debounceMs = 1000, payloadBuilder, onSuccess, onError } = options;

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const nodePositions = useCanvasStore((s) => s.nodePositions);

  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const lastSavedHashRef = useRef<string>('');
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const buildPayload = useCallback((): SavePayload => {
    // nodePositions를 실제 노드 위치에 병합하여 저장
    const composedNodes = nodes.map((n) => ({
      ...n,
      position: nodePositions[n.id] || n.position,
    }));
    const base = { nodes: composedNodes, edges };
    return payloadBuilder ? payloadBuilder(base) : base;
  }, [nodes, edges, nodePositions, payloadBuilder]);

  const doSave = useCallback(async (force = false) => {
    const payload = buildPayload();
    const currentHash = JSON.stringify(payload);
    if (!force && currentHash === lastSavedHashRef.current) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/canvases/${canvasId}/state`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ flowJson: payload }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      lastSavedHashRef.current = currentHash;
      setLastSavedAt(Date.now());
      onSuccess?.();
    } catch (err) {
      onError?.(err);
      // 실패 시 해시는 갱신하지 않음 (다음 변경 또는 수동 저장에서 재시도)
    } finally {
      setSaving(false);
    }
  }, [buildPayload, canvasId, onSuccess, onError]);

  const scheduleSave = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      doSave(false);
    }, debounceMs);
  }, [doSave, debounceMs]);

  // 상태 변화 감지 → 디바운스 저장
  useEffect(() => {
    scheduleSave();
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [nodes, edges, nodePositions, scheduleSave]);

  // 외부에서 호출 가능한 저장 트리거
  const triggerSave = useCallback(
    async (_reason?: string, immediate = false) => {
      if (immediate) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        await doSave(true);
      } else {
        scheduleSave();
      }
    },
    [doSave, scheduleSave]
  );

  return {
    saving,
    lastSavedAt,
    triggerSave,
  } as const;
}


