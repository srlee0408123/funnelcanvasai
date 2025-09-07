import Link from "next/link";
import { Button } from "@/components/Ui/buttons";
import { 
  ArrowLeft,
  Check,
  X,
  Edit,
  Clock,
  Share,
  Plus,
  Minus,
  Save,
  Loader2,
} from "lucide-react";
import { useEffect, useMemo, useState, useCallback } from "react";
import type { Canvas, CanvasState } from "@shared/schema";

/**
 * CanvasHeader - 캔버스 상단 헤더 영역 컴포넌트
 * 
 * 주요 역할:
 * 1. 캔버스 제목 표시 및 인라인 편집
 * 2. 저장/공유/줌 컨트롤 버튼 제공
 * 3. 노드 추가(모달 오픈 트리거) 및 뷰포트 제어
 * 
 * 핵심 특징:
 * - 제목 편집 상태를 내부에서 관리하고 저장 콜백을 통해 상위에 반영
 * - Tailwind 기반의 일관된 UI와 접근성 고려
 * - 불필요한 리렌더 방지를 위한 useMemo/useCallback 최적화
 * 
 * 주의사항:
 * - 상위에서 전달하는 onUpdateTitle, onManualSave는 실패 처리/토스트를 담당해야 함
 * - setViewport는 확대/축소 시 최소/최대 범위를 상위에서 보장
 */
export interface CanvasHeaderProps {
  canvas: Canvas;
  canvasState?: CanvasState;
  isReadOnly?: boolean;
  viewport: { x: number; y: number; zoom: number };
  setViewport: (v: { x: number; y: number; zoom: number }) => void;
  canShare?: boolean;
  onOpenShareModal?: () => void;
  onOpenCreateNode: () => void;
  onManualSave: () => void;
  onUpdateTitle: (newTitle: string) => Promise<void> | void;
  onResetOrCenterViewport: () => void;
  lastSavedAt?: number | null;
  isSaving?: boolean;
}

export function CanvasHeader({
  canvas,
  canvasState,
  isReadOnly = false,
  viewport,
  setViewport,
  canShare,
  onOpenShareModal,
  onOpenCreateNode,
  onManualSave,
  onUpdateTitle,
  onResetOrCenterViewport,
  lastSavedAt,
  isSaving = false,
}: CanvasHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  const lastSavedText = useMemo(() => {
    if (lastSavedAt) return new Date(lastSavedAt).toLocaleString();
    return canvasState ? new Date(canvasState.createdAt!).toLocaleString() : "저장된 상태 없음";
  }, [lastSavedAt, canvasState]);

  const handleTitleEdit = useCallback(() => {
    if (isReadOnly) return;
    setEditedTitle(canvas.title);
    setIsEditingTitle(true);
  }, [canvas.title, isReadOnly]);

  const handleTitleSave = useCallback(async () => {
    if (!editedTitle.trim() || editedTitle === canvas.title) {
      setIsEditingTitle(false);
      return;
    }
    
    setIsSavingTitle(true);
    try {
      await onUpdateTitle(editedTitle.trim());
      setIsEditingTitle(false);
    } catch (error) {
      // 에러 발생 시 편집 상태 유지 (사용자가 다시 시도할 수 있도록)
      console.error('Title save failed:', error);
    } finally {
      setIsSavingTitle(false);
    }
  }, [editedTitle, canvas.title, onUpdateTitle]);

  const handleTitleCancel = useCallback(() => {
    setEditedTitle("");
    setIsEditingTitle(false);
  }, []);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleTitleCancel();
    }
  }, [handleTitleSave, handleTitleCancel]);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between group">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="워크스페이스로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {isEditingTitle ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleTitleSave}
                className="font-semibold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none text-lg px-1"
                autoFocus
                disabled={isSavingTitle}
              />
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleTitleSave}
                  disabled={isSavingTitle}
                  className="p-1 text-green-600 hover:bg-green-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isSavingTitle ? "저장 중..." : "저장"}
                >
                  {isSavingTitle ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={handleTitleCancel}
                  disabled={isSavingTitle}
                  className="p-1 text-red-600 hover:bg-red-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="취소"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <h2 
              className={`font-semibold text-gray-900 flex items-center space-x-2 ${!isReadOnly ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
              onClick={!isReadOnly ? handleTitleEdit : undefined}
              title={!isReadOnly ? "클릭해서 이름 변경" : ""}
            >
              <span>{canvas.title}</span>
              {isSavingTitle ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              ) : (
                !isReadOnly && <Edit className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </h2>
          )}
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>마지막 저장: {lastSavedText}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {!isReadOnly && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onOpenCreateNode}
              title="노드 추가"
              className="hover:bg-blue-50 hover:text-blue-600"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {!isReadOnly && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={onManualSave}
              disabled={isSaving}
              title={isSaving ? "저장 중..." : "수동 저장"}
              className={isSaving ? "cursor-not-allowed" : ""}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          )}
          {(typeof canShare === 'boolean' ? canShare : !isReadOnly) && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onOpenShareModal?.()}
              title="캔버스 사용자 공유"
            >
              <Share className="h-4 w-4" />
            </Button>
          )}
          <div className="w-px h-6 bg-gray-200"></div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onResetOrCenterViewport}
          >
            {Math.round(viewport.zoom * 100)}%
          </Button>
          <div className="flex items-center space-x-1">
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                // 10% 단위 줌 인, 50%~200% 범위 제한
                const STEP = 0.1;
                const MIN_ZOOM = 0.5; // 최소 50%
                const MAX_ZOOM = 2.0; // 최대 200%
                const target = viewport.zoom + STEP;
                const quantized = Math.round(target * 10) / 10;
                const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, quantized));
                setViewport({ ...viewport, zoom: newZoom });
              }}
              disabled={viewport.zoom >= 2.0}
              title="줌 인 (10% 단위)"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                // 10% 단위 줌 아웃, 50%~200% 범위 제한
                const STEP = 0.1;
                const MIN_ZOOM = 0.5; // 최소 50%
                const MAX_ZOOM = 2.0; // 최대 200%
                const target = viewport.zoom - STEP;
                const quantized = Math.round(target * 10) / 10;
                const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, quantized));
                setViewport({ ...viewport, zoom: newZoom });
              }}
              disabled={viewport.zoom <= 0.5}
              title="줌 아웃 (10% 단위)"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
