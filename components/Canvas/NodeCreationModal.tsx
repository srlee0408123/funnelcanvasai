import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface NodeData {
  title: string;
  description: string;
  icon: string;
  color: string;
}

interface NodeCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateNode: (nodeData: NodeData) => void;
  onCreateMemo?: (position: { x: number; y: number }, content: string) => void;
  position: { x: number; y: number };
}

export default function NodeCreationModal({
  isOpen,
  onClose,
  onCreateNode,
  onCreateMemo,
  position
}: NodeCreationModalProps) {
  const [mode, setMode] = useState<'node' | 'memo'>('node');
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [memoContent, setMemoContent] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("📝");
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setMode('node');
      setTitle("");
      setDescription("");
      setMemoContent("");
      setSelectedIcon("📝");
      setSelectedColor("#3B82F6");
    }
  }, [isOpen]);

  // Focus textarea when switching to memo mode
  useEffect(() => {
    if (mode === 'memo' && textareaRef.current) {
      // Small delay to ensure the textarea is rendered
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    }
  }, [mode]);

  // Available icons and colors for selection
  const availableIcons = [
    "📝", "📊", "📈", "📉", "📋", "📌", "📍", "🎯", "🎨", "🎪",
    "💡", "💰", "💎", "💻", "💼", "📱", "📧", "📞", "🌟", "⚡",
    "🚀", "🎉", "🔥", "❤️", "👥", "🏆", "🎁", "📦", "🛍️", "🔧"
  ];

  const availableColors = [
    "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6",
    "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6B7280"
  ];

  const handleCreateNode = () => {
    if (!title.trim()) return;
    
    const nodeData: NodeData = {
      title: title.trim(),
      description: description.trim(),
      icon: selectedIcon,
      color: selectedColor
    };
    
    onCreateNode(nodeData);
    onClose();
  };

  const handleCreateMemo = () => {
    if (!memoContent.trim() || !onCreateMemo) return;
    
    onCreateMemo(position, memoContent.trim());
    onClose();
  };

  const isFormValid = mode === 'node' ? title.trim().length > 0 : memoContent.trim().length > 0;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (isFormValid) {
        if (mode === 'node') {
          handleCreateNode();
        } else {
          handleCreateMemo();
        }
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <i className="fas fa-plus-circle text-blue-600"></i>
              {mode === 'node' ? '새 노드 추가' : '새 메모 추가'}
            </DialogTitle>
            {/* Mode Switch Tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setMode('node')}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  mode === 'node' 
                    ? 'bg-white text-blue-600 font-medium shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <i className="fas fa-sitemap mr-1"></i>
                노드
              </button>
              <button
                type="button"
                onClick={() => setMode('memo')}
                className={`px-3 py-1 rounded-md text-sm transition-colors ${
                  mode === 'memo' 
                    ? 'bg-white text-yellow-600 font-medium shadow-sm' 
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <i className="fas fa-sticky-note mr-1"></i>
                메모
              </button>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            위치: ({Math.round(position.x)}, {Math.round(position.y)})
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 min-h-0">
          {mode === 'node' ? (
            <>
              {/* Node Title */}
              <div className="space-y-2">
                <Label htmlFor="nodeTitle">노드 제목</Label>
                <Input
                  id="nodeTitle"
                  placeholder="예: 환영 이메일, 랜딩 페이지, 소셜 미디어 포스트..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full"
                  autoFocus
                  onMouseDown={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="nodeDescription">설명 (선택사항)</Label>
                <Textarea
                  id="nodeDescription"
                  placeholder="이 노드에서 무엇이 일어나는지 설명해보세요..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-20 resize-none"
                  onMouseDown={(e) => e.stopPropagation()}
                  onFocus={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

              {/* Icon Selection */}
              <div className="space-y-2">
                <Label>아이콘 선택</Label>
                <div className="grid grid-cols-10 gap-2 max-h-[120px] overflow-y-auto p-2 border rounded-lg">
                  {availableIcons.map((icon, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedIcon(icon)}
                      className={`w-8 h-8 text-lg rounded border-2 transition-colors hover:bg-gray-100 ${
                        selectedIcon === icon 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-200'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selection */}
              <div className="space-y-2">
                <Label>색상 선택</Label>
                <div className="flex gap-2 flex-wrap">
                  {availableColors.map((color, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                        selectedColor === color 
                          ? 'border-gray-800 scale-110' 
                          : 'border-gray-300'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>미리보기</Label>
                <div className="p-3 border border-gray-200 rounded-md bg-gray-50">
                  <div
                    className="inline-flex items-center gap-3 px-6 py-4 rounded-lg border-2 shadow-sm min-w-[160px]"
                    style={{ 
                      backgroundColor: selectedColor + '20',
                      borderColor: selectedColor + '40',
                      color: selectedColor
                    }}
                  >
                    <span className="text-2xl">{selectedIcon}</span>
                    <div className="text-left flex-1">
                      <div className="font-medium text-base">{title || "노드 제목"}</div>
                      {description && (
                        <div className="text-sm opacity-75 mt-1">{description}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Memo Mode */
            <div className="space-y-2">
              <Label htmlFor="memoContent">메모 내용</Label>
              <Textarea
                ref={textareaRef}
                id="memoContent"
                placeholder="메모 내용을 입력하세요..."
                value={memoContent}
                onChange={(e) => setMemoContent(e.target.value)}
                onKeyDown={(e) => {
                  // Allow Enter key for new lines in memo content
                  if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
                    // Don't prevent default - allow new line
                    e.stopPropagation();
                  }
                }}
                className="w-full h-32 resize-none"
                autoFocus={mode === 'memo'}
                onMouseDown={(e) => e.stopPropagation()}
                onFocus={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              />
              <div className="text-sm text-gray-500">
                메모는 노란색 스티커 노트로 생성되며, 크기를 조정할 수 있습니다.
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button 
            onClick={mode === 'node' ? handleCreateNode : handleCreateMemo}
            disabled={!isFormValid}
            className="flex-1"
          >
            {mode === 'node' ? '노드 생성' : '메모 생성'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}