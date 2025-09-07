import React, { useState, useRef, useEffect } from 'react';
import { X, Edit3, Check, Type } from 'lucide-react';

interface TextMemoProps {
  id: string;
  position: { x: number; y: number };
  content: string;
  size?: { width: number; height: number };
  isSelected?: boolean;
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
  onSelect: (id: string) => void;
  onPositionChange: (id: string, position: { x: number; y: number }) => void;
  onSizeChange: (id: string, size: { width: number; height: number }) => void;
  viewport?: { x: number; y: number; zoom: number };
  isReadOnly?: boolean;
}

export const TextMemo: React.FC<TextMemoProps> = ({
  id,
  position,
  content,
  size = { width: 250, height: 150 },
  isSelected,
  onUpdate,
  onDelete,
  onSelect,
  onPositionChange,
  onSizeChange,
  viewport = { x: 0, y: 0, zoom: 1 },
  isReadOnly = false
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  // RAF 기반 드래그 제어용 ref들
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const isDragStartedRef = useRef(false);
  const dragStartMouseRef = useRef({ x: 0, y: 0 });
  const originalPosRef = useRef({ x: 0, y: 0 });
  const rafIdRef = useRef<number | null>(null);
  const latestMouseRef = useRef({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      // Add a small delay to ensure DOM is ready
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.select();
          console.log('🔄 TextMemo: Focused textarea');
        }
      }, 50);
    }
  }, [isEditing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing || isResizing || isReadOnly) return;
    
    e.stopPropagation();
    onSelect(id);
    
    setIsDragging(true);
    isDraggingRef.current = true;
    // 뷰포트 변환을 고려한 드래그 시작점 계산
    const canvasX = (e.clientX - viewport.x) / viewport.zoom;
    const canvasY = (e.clientY - viewport.y) / viewport.zoom;
    setDragStart({
      x: canvasX - position.x,
      y: canvasY - position.y
    });
    // RAF 드래그 준비
    isDragStartedRef.current = false;
    dragStartMouseRef.current = { x: e.clientX, y: e.clientY };
    latestMouseRef.current = { x: e.clientX, y: e.clientY };
    originalPosRef.current = { x: position.x, y: position.y };
    const el = containerRef.current;
    if (el) {
      el.style.willChange = 'transform';
      el.style.transition = 'none';
    }
  };

  const DRAG_THRESHOLD = 4;

  // RAF 루프: 드래그 중 transform으로만 이동(리렌더 방지)
  const runDragLoop = React.useCallback(() => {
    if (!isDraggingRef.current || !isDragStartedRef.current) return;
    const el = containerRef.current;
    if (!el) return;
    const dx = latestMouseRef.current.x - dragStartMouseRef.current.x;
    const dy = latestMouseRef.current.y - dragStartMouseRef.current.y;
    const absX = originalPosRef.current.x + dx / (viewport.zoom || 1);
    const absY = originalPosRef.current.y + dy / (viewport.zoom || 1);
    // relative offset vs left/top
    const relX = absX - position.x;
    const relY = absY - position.y;
    el.style.transform = `translate3d(${relX}px, ${relY}px, 0)`;
    rafIdRef.current = window.requestAnimationFrame(runDragLoop);
  }, [viewport.zoom, position.x, position.y]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (isReadOnly) return;
    e.stopPropagation();
    console.log('🔄 TextMemo: Starting edit mode');
    setIsEditing(true);
  };

  // Add single click handler for better UX
  const handleSingleClick = (e: React.MouseEvent) => {
    if (isReadOnly || isEditing) return;
    e.stopPropagation();
    onSelect(id);
  };

  const handleSave = () => {
    onUpdate(id, editContent);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditContent(content);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleCancel();
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSave();
    }
  };

  // Global mouse/pointer events for dragging and resizing
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDraggingRef.current) {
        latestMouseRef.current = { x: e.clientX, y: e.clientY };
        if (!isDragStartedRef.current) {
          const dx = Math.abs(e.clientX - dragStartMouseRef.current.x);
          const dy = Math.abs(e.clientY - dragStartMouseRef.current.y);
          if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
            isDragStartedRef.current = true;
            if (rafIdRef.current === null) rafIdRef.current = window.requestAnimationFrame(runDragLoop);
          }
        }
      } else if (isResizing) {
        // 뷰포트 줌을 고려한 리사이즈 계산
        const deltaX = (e.clientX - resizeStart.x) / viewport.zoom;
        const deltaY = (e.clientY - resizeStart.y) / viewport.zoom;
        
        const newSize = {
          width: Math.max(200, Math.min(600, resizeStart.width + deltaX)), // 반응형 크기 범위
          height: Math.max(120, Math.min(400, resizeStart.height + deltaY))  // 반응형 크기 범위
        };
        
        onSizeChange(id, newSize);
      }
    };

    const handleGlobalMouseUp = () => {
      if (isDraggingRef.current) {
        // 최종 위치 커밋
        const dx = latestMouseRef.current.x - dragStartMouseRef.current.x;
        const dy = latestMouseRef.current.y - dragStartMouseRef.current.y;
        const absX = originalPosRef.current.x + dx / (viewport.zoom || 1);
        const absY = originalPosRef.current.y + dy / (viewport.zoom || 1);
        onPositionChange(id, { x: absX, y: absY });
        const el = containerRef.current;
        if (el) {
          el.style.transform = '';
          el.style.willChange = '';
          el.style.transition = '';
        }
      }
      setIsDragging(false);
      isDraggingRef.current = false;
      isDragStartedRef.current = false;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, resizeStart, id, onPositionChange, onSizeChange, viewport.x, viewport.y, viewport.zoom, runDragLoop]);

  return (
    <div
      ref={containerRef}
      className={`absolute bg-gradient-to-br from-yellow-50 to-amber-100 border-2 shadow-lg rounded-xl p-4 cursor-move select-none transition-all duration-200 hover:shadow-xl ${
        isSelected ? 'border-blue-400 shadow-blue-200/50' : 'border-amber-300'
      } ${(isDragging || isResizing) ? 'z-50 shadow-2xl' : 'z-10'} ${
        isDragging ? 'scale-105 rotate-1' : 'scale-100'
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${Math.max(200, Math.min(600, size.width))}px`, // 반응형 최소/최대 크기
        height: `${Math.max(120, Math.min(400, size.height))}px`,
        minWidth: '200px',
        maxWidth: '600px',
        minHeight: '120px',
        maxHeight: '400px'
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={handleDoubleClick}
      onClick={handleSingleClick}
      data-memo-id={id}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-amber-200 rounded-lg flex items-center justify-center">
            <Type size={12} className="text-amber-700" />
          </div>
          <span className="text-sm font-semibold text-amber-800">메모</span>
        </div>
        <div className="flex items-center space-x-1">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="p-1.5 hover:bg-green-100 rounded-lg transition-all duration-200 hover:scale-110"
                title="저장 (Ctrl+Enter)"
              >
                <Check size={14} className="text-green-600" />
              </button>
              <button
                onClick={handleCancel}
                className="p-1.5 hover:bg-red-100 rounded-lg transition-all duration-200 hover:scale-110"
                title="취소 (Esc)"
              >
                <X size={14} className="text-red-600" />
              </button>
            </>
          ) : (
            !isReadOnly && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  className="p-1.5 hover:bg-amber-200 rounded-lg transition-all duration-200 hover:scale-110"
                  title="편집"
                >
                  <Edit3 size={14} className="text-amber-700" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(id);
                  }}
                  className="p-1.5 hover:bg-red-100 rounded-lg transition-all duration-200 hover:scale-110"
                  title="삭제"
                >
                  <X size={14} className="text-red-600" />
                </button>
              </>
            )
          )}
        </div>
      </div>

      {/* Content */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full p-3 text-sm bg-white border border-amber-300 rounded-lg resize-none focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 transition-all duration-200"
          style={{ 
            height: `${Math.max(60, size.height - 80)}px`,
            minHeight: '60px'
          }}
          placeholder="메모를 입력하세요..."
          onMouseDown={(e) => e.stopPropagation()}
          onFocus={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div 
          className="text-sm text-gray-800 whitespace-pre-wrap break-words overflow-auto leading-relaxed cursor-pointer"
          style={{ height: `${Math.max(60, size.height - 80)}px` }}
          onClick={(e) => {
            if (!isReadOnly) {
              e.stopPropagation();
              setIsEditing(true);
              console.log('🔄 TextMemo: Content area clicked - starting edit mode');
            }
          }}
        >
          {content || (
            <span className="text-gray-400 italic">클릭하여 메모를 작성하세요...</span>
          )}
        </div>
      )}

      {/* Usage hint */}
      {!isEditing && !content && (
        <div className="text-xs text-yellow-600 mt-2 opacity-60">
          클릭하여 편집
        </div>
      )}
      
      {/* Resize handles */}
      {isSelected && !isReadOnly && (
        <>
          {/* Corner resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gradient-to-br from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 transition-all duration-200 opacity-80 hover:opacity-100 rounded-tl-lg shadow-sm"
            style={{
              clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)'
            }}
            onMouseDown={handleResizeMouseDown}
            title="크기 조정"
          />
          {/* Edge resize handles */}
          <div
            className="absolute right-0 top-1/2 transform -translate-y-1/2 w-2 h-8 cursor-e-resize bg-amber-300 hover:bg-amber-400 transition-colors duration-200 opacity-60 hover:opacity-80 rounded-l-sm"
            onMouseDown={handleResizeMouseDown}
          />
          <div
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-8 h-2 cursor-s-resize bg-amber-300 hover:bg-amber-400 transition-colors duration-200 opacity-60 hover:opacity-80 rounded-t-sm"
            onMouseDown={handleResizeMouseDown}
          />
        </>
      )}
    </div>
  );
};
