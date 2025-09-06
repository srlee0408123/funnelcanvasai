/**
 * NodeDetailsPanel - 캔버스 노드의 상세 정보 편집 패널
 * 
 * 주요 역할:
 * 1. 노드 정보 조회 및 실시간 동기화
 * 2. 노드 속성 편집 (제목, 설명, 아이콘, 색상, 담당자)
 * 3. 노드 삭제 및 변경사항 저장
 * 
 * 핵심 특징:
 * - 실시간 데이터 동기화를 위한 자동 리패치
 * - 타이핑 기반 담당자 입력 시스템
 * - 에러 상태 및 로딩 상태 처리
 * 
 * 주의사항:
 * - 노드 ID 변경 시 자동으로 데이터 리패치
 * - 캔버스 상태와 flowJson 양방향 호환성 유지
 * - 삭제 시 연결된 엣지도 함께 제거
 */

import { Button } from "@/components/Ui/buttons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { X } from "lucide-react";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import IconPickerModal from "../Modals/IconPickerModal";

interface NodeDetailsPanelProps {
  nodeId: string;
  canvasId: string;
  onClose: () => void;
}

interface AssigneeInputProps {
  currentAssignees: string[];
  onAssigneesChange: (assignees: string[]) => void;
  availableMembers?: Array<{ id: string; displayName: string; email: string }>;
}

interface NodeData {
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  assignees: string[];
}

// 공통 유틸리티 함수들
const getInitials = (name: string): string => {
  const words = name.split(" ");
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

const getFlowData = (canvasState: any) => 
  canvasState?.state ?? canvasState?.flowJson ?? null;

const findNodeById = (flowData: any, nodeId: string) => 
  flowData?.nodes?.find((n: any) => n.id === nodeId);

// 공통 헤더 컴포넌트
const PanelHeader = ({ title, onClose, icon, color, subtitle }: {
  title: string;
  onClose: () => void;
  icon?: string;
  color?: string;
  subtitle?: string;
}) => (
  <div className="p-4 border-b border-gray-100">
    <div className="flex items-center justify-between">
      {icon && color ? (
        <div className="flex items-center space-x-2">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center border"
            style={{
              backgroundColor: color + '20',
              color: color,
              borderColor: color + '40'
            }}
          >
            <span className="text-lg">{icon}</span>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
      ) : (
        <h2 className="font-semibold text-gray-900">{title}</h2>
      )}
      <button
        onClick={onClose}
        className="p-1 rounded-md hover:bg-gray-100 transition-colors"
        aria-label="패널 닫기"
      >
        <X className="h-5 w-5 text-gray-600" />
      </button>
    </div>
  </div>
);

// 로딩/에러 상태 공통 컴포넌트
const PanelState = ({ type, message, nodeId, availableNodeIds, onRetry, onClose }: {
  type: 'loading' | 'error';
  message: string;
  nodeId?: string;
  availableNodeIds?: string[];
  onRetry?: () => void;
  onClose: () => void;
}) => (
  <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
    <PanelHeader title="노드 세부사항" onClose={onClose} />
    <div className="flex-1 flex items-center justify-center p-4">
      {type === 'loading' ? (
        <p className="text-gray-500 text-sm">{message}</p>
      ) : (
        <div className="text-center">
          <p className="text-gray-500 text-sm">{message}</p>
          {nodeId && <p className="text-gray-400 text-xs mt-1">노드 ID: {nodeId}</p>}
          {availableNodeIds && (
            <p className="text-gray-400 text-xs mt-1">총 노드 수: {availableNodeIds.length}</p>
          )}
          {onRetry && (
            <button 
              onClick={onRetry}
              className="mt-3 px-3 py-1 bg-yellow-600 text-primary-foreground text-sm rounded hover:bg-yellow-700"
            >
              다시 로드
            </button>
          )}
        </div>
      )}
    </div>
  </div>
);

// Google 스프레드시트 스타일 담당자 선택 컴포넌트
function AssigneeInput({ currentAssignees, onAssigneesChange, availableMembers = [] }: AssigneeInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 필터링된 멤버 목록 (입력값 기반 + 이미 선택되지 않은 사용자만)
  const filteredMembers = useMemo(() => {
    const term = inputValue.trim().toLowerCase();
    return availableMembers.filter((m) => {
      const isNotSelected = !currentAssignees.includes(m.email);
      if (!term) return isNotSelected;
      return (
        isNotSelected && (
          (m.displayName || "").toLowerCase().includes(term) ||
          (m.email || "").toLowerCase().includes(term)
        )
      );
    });
  }, [inputValue, availableMembers, currentAssignees]);

  // 사용자 추가(존재 사용자만)
  const addAssignee = useCallback((member: { displayName: string; email: string } | null) => {
    if (!member) return;
    if (!member.email) return;
    if (!currentAssignees.includes(member.email)) {
      onAssigneesChange([...currentAssignees, member.email]);
      setInputValue("")
      setShowDropdown(false);
      setSelectedIndex(-1);
    }
  }, [currentAssignees, onAssigneesChange]);

  // 사용자 제거
  const removeAssignee = useCallback((index: number) => {
    const newAssignees = currentAssignees.filter((_, i) => i !== index);
    onAssigneesChange(newAssignees);
  }, [currentAssignees, onAssigneesChange]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showDropdown) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setShowDropdown(true);
        setSelectedIndex(filteredMembers.length > 0 ? 0 : -1);
        e.preventDefault();
      } else if (e.key === 'Backspace' && inputValue === '' && currentAssignees.length > 0) {
        removeAssignee(currentAssignees.length - 1);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < filteredMembers.length - 1 ? prev + 1 : prev);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : 0);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < filteredMembers.length) {
          const member = filteredMembers[selectedIndex];
          addAssignee({ displayName: member.displayName, email: member.email });
        } else if (filteredMembers.length === 1) {
          const member = filteredMembers[0];
          addAssignee({ displayName: member.displayName, email: member.email });
        }
        break;
      case ',':
      case 'Tab':
        if (filteredMembers.length > 0) {
          e.preventDefault();
          const member = filteredMembers[Math.max(0, selectedIndex)];
          addAssignee({ displayName: member.displayName, email: member.email });
        }
        break;
      case 'Escape':
        setShowDropdown(false);
        setSelectedIndex(-1);
        break;
      case 'Backspace':
        if (inputValue === '' && currentAssignees.length > 0) {
          removeAssignee(currentAssignees.length - 1);
        }
        break;
    }
  }, [showDropdown, selectedIndex, filteredMembers, addAssignee, inputValue, currentAssignees.length, removeAssignee]);

  // 입력 변경
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    setShowDropdown(true);
    setSelectedIndex(0);
  }, []);

  // 포커스/블러
  const handleInputFocus = useCallback(() => {
    setShowDropdown(true);
    setSelectedIndex(0);
  }, []);

  const handleInputBlur = useCallback(() => {
    // 클릭 선택 허용을 위해 지연 후 닫기
    setTimeout(() => {
      setShowDropdown(false);
      setSelectedIndex(-1);
    }, 150);
  }, []);

  // 외부 클릭 닫기
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 선택된 담당자 + 입력 */}
      <div
        className="border border-gray-300 rounded-lg p-2 min-h-[40px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        <div className="flex flex-wrap gap-1 items-center">
          {currentAssignees.map((assigneeEmail, index) => {
            const member = availableMembers.find(m => m.email === assigneeEmail);
            const displayName = member?.displayName || assigneeEmail;
            return (
              <div
                key={`${assigneeEmail}-${index}`}
                className="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm"
              >
                <div className="w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  {getInitials(displayName)}
                </div>
                <span>{displayName}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); removeAssignee(index); }}
                  className="text-blue-600 hover:text-blue-800 ml-1 hover:bg-blue-200 rounded-full w-4 h-4 flex items-center justify-center"
                >
                  <i className="fas fa-times text-xs"></i>
                </button>
              </div>
            );
          })}

          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            placeholder={currentAssignees.length === 0 ? "담당자를 추가하세요" : ""}
            className="flex-1 min-w-[120px] outline-none text-sm bg-transparent"
          />
        </div>
      </div>

      {/* 드롭다운 */}
      {showDropdown && (
        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-auto">
          {filteredMembers.length > 0 ? (
            filteredMembers.map((member, index) => (
              <button
                key={member.id}
                type="button"
                className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
                  index === selectedIndex ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50 text-gray-900'
                }`}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => addAssignee({ displayName: member.displayName, email: member.email })}
              >
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-medium flex-shrink-0">
                  {getInitials(member.displayName || member.email)}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-medium truncate">{member.displayName || member.email}</span>
                  {member.displayName && (
                    <span className="text-xs text-gray-500 truncate">{member.email}</span>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="px-3 py-4 text-sm text-gray-500 text-center">
              {availableMembers.length === 0
                ? '캔버스에 공유된 멤버가 없습니다.'
                : inputValue.trim()
                  ? '검색 결과가 없습니다.'
                  : '모든 멤버가 이미 추가되었습니다.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function NodeDetailsPanel({ nodeId, canvasId, onClose }: NodeDetailsPanelProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const setNodes = useCanvasStore(s => s.setNodes);
  const setEdges = useCanvasStore(s => s.setEdges);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // 노드 데이터 상태 통합 관리
  const [nodeData, setNodeData] = useState<NodeData>({
    title: "",
    subtitle: "",
    icon: "📄",
    color: "#3B82F6",
    assignees: []
  });

  // 캔버스 상태 조회 - 실시간 동기화
  const { data: canvasState, isLoading, refetch } = useQuery({
    queryKey: ["/api/canvases", canvasId, "state", "latest"],
    enabled: !!canvasId,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  // 캔버스 공유 멤버 조회 → 담당자 제안에 사용
  const { data: canvasShares = [] } = useQuery({
    queryKey: ["/api/canvases", canvasId, "shares"],
    enabled: !!canvasId,
    queryFn: async () => {
      const res = await fetch(`/api/canvases/${canvasId}/shares`, { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });

  // 노드 ID 변경 시 자동 리패치
  useEffect(() => {
    if (nodeId && canvasId) {
      refetch();
    }
  }, [nodeId, canvasId, refetch]);

  const flowData = getFlowData(canvasState);
  const node = findNodeById(flowData, nodeId);

  // 캔버스 상태 업데이트 공통 함수
  const updateCanvasState = useCallback(async (updatedFlowData: any) => {
    const response = await fetch(`/api/canvases/${canvasId}/state`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ flowJson: updatedFlowData })
    });
    
    if (response.ok) {
      await queryClient.invalidateQueries({ 
        queryKey: ["/api/canvases", canvasId, "state", "latest"] 
      });
      return true;
    }
    throw new Error('캔버스 상태 업데이트 실패');
  }, [canvasId, queryClient]);

  // 노드 데이터 초기화
  useEffect(() => {
    if (node?.data) {
      setNodeData({
        title: node.data.title || "",
        subtitle: node.data.subtitle || "",
        icon: node.data.icon || "📄",
        color: node.data.color || "#3B82F6",
        assignees: node.data.assignees || []
      });
    }
  }, [node]);

  const availableNodeIds = flowData?.nodes?.map((n: any) => n.id) || [];

  // 노드 데이터 업데이트 핸들러
  const updateNodeData = useCallback((field: keyof NodeData, value: any) => {
    setNodeData(prev => ({ ...prev, [field]: value }));
  }, []);

  // 변경사항 저장 핸들러
  const handleSaveChanges = useCallback(async () => {
    if (!node || !flowData || isSaving) return;
    
    setIsSaving(true);
    try {
      const updatedNodes = flowData.nodes.map((n: any) => 
        n.id === nodeId ? { ...n, data: { ...n.data, ...nodeData } } : n
      );
      
      await updateCanvasState({ ...flowData, nodes: updatedNodes });
      // 즉시 UI 반영(Zustand 스토어 업데이트)
      setNodes(updatedNodes);
      toast({ 
        title: "변경사항 저장됨", 
        description: "노드 정보가 성공적으로 업데이트되었습니다." 
      });
    } catch (error) {
      console.error("Error saving node changes:", error);
      toast({ 
        title: "저장 실패", 
        description: "노드 정보 저장 중 오류가 발생했습니다.", 
        variant: "destructive" 
      });
    } finally {
      setIsSaving(false);
    }
  }, [node, flowData, nodeId, nodeData, updateCanvasState, toast, setNodes, isSaving]);

  // 노드 삭제 핸들러
  const handleDeleteNode = useCallback(async () => {
    if (!node || !flowData) return;
    
    const confirmed = window.confirm("정말로 이 노드를 삭제하시겠습니까?");
    if (!confirmed) return;
    
    try {
      const updatedNodes = flowData.nodes.filter((n: any) => n.id !== nodeId);
      const updatedEdges = (flowData.edges || []).filter((edge: any) => 
        edge.source !== nodeId && edge.target !== nodeId
      );
      
      await updateCanvasState({ ...flowData, nodes: updatedNodes, edges: updatedEdges });
      // 즉시 UI 반영(Zustand 스토어 업데이트)
      setNodes(updatedNodes);
      setEdges(updatedEdges);
      onClose();
    } catch (error) {
      console.error("Error deleting node:", error);
      toast({ 
        title: "삭제 실패", 
        description: "노드 삭제 중 오류가 발생했습니다.", 
        variant: "destructive" 
      });
    }
  }, [node, flowData, nodeId, updateCanvasState, onClose, toast, setNodes, setEdges]);

  // 로딩 상태 처리
  if (isLoading || !canvasState) {
    return <PanelState type="loading" message="캔버스 데이터를 불러오는 중..." onClose={onClose} />;
  }

  // 노드 존재 여부 확인
  if (!node?.id) {
    return (
      <PanelState 
        type="error" 
        message="선택된 노드를 찾을 수 없습니다." 
        nodeId={nodeId}
        availableNodeIds={availableNodeIds}
        onRetry={refetch}
        onClose={onClose}
      />
    );
  }

  return (
    <div className="w-80 bg-white border-l border-gray-200 flex flex-col transition-all duration-300">
      <PanelHeader 
        title={nodeData.title || node.data.title}
        subtitle="노드 세부 설정"
        icon={nodeData.icon || node.data.icon}
        color={nodeData.color || node.data.color}
        onClose={onClose}
      />

      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {/* 노드 제목 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">노드 제목</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={nodeData.title}
              onChange={(e) => updateNodeData('title', e.target.value)}
            />
          </div>

          {/* 아이콘과 색상 */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">아이콘</label>
              <button
                type="button"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center text-lg bg-white hover:bg-gray-50"
                onClick={() => setShowIconPicker(true)}
                aria-label="아이콘 선택"
              >
                {nodeData.icon}
              </button>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
              <input
                type="color"
                className="w-full h-10 border border-gray-300 rounded-lg cursor-pointer"
                value={nodeData.color}
                onChange={(e) => updateNodeData('color', e.target.value)}
              />
            </div>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
            <textarea
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-48"
              value={nodeData.subtitle}
              onChange={(e) => updateNodeData('subtitle', e.target.value)}
              placeholder="노드에 대한 자세한 설명을 입력하세요..."
              rows={10}
            />
          </div>

          {/* 담당자 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">담당자</label>
            <AssigneeInput 
              currentAssignees={nodeData.assignees} 
              onAssigneesChange={(assignees) => updateNodeData('assignees', assignees)} 
              availableMembers={(Array.isArray(canvasShares) ? canvasShares : []).map((share: any) => ({
                id: (share.user?.id) || share.userId || share.id,
                displayName: ((share.user?.firstName && share.user?.lastName)
                  ? `${share.user.firstName} ${share.user.lastName}`
                  : (share.user?.firstName || share.user?.lastName || share.user?.email || '')),
                email: share.user?.email || ''
              }))}
            />
          </div>

          {/* 액션 버튼 */}
          <div className="pt-4 space-y-2">
            <Button 
              className="w-full" 
              variant="outline"
              onClick={handleSaveChanges}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2"></div>
                  저장 중...
                </>
              ) : (
                <>
                  <i className="fas fa-save mr-2"></i>
                  변경사항 저장
                </>
              )}
            </Button>

            <Button 
              className="w-full" 
              variant="destructive"
              onClick={handleDeleteNode}
            >
              <i className="fas fa-trash mr-2"></i>
              노드 삭제
            </Button>
          </div>
        </div>
      </div>

      {/* 아이콘 선택 모달 */}
      <IconPickerModal
        open={showIconPicker}
        onOpenChange={setShowIconPicker}
        onSelect={(icon: string) => {
          updateNodeData('icon', icon);
          setShowIconPicker(false);
        }}
      />
    </div>
  );
}


