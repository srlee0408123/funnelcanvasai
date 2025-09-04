"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

import Sidebar from "@/components/Layout/Sidebar";
import CanvasArea from "@/components/Layout/CanvasArea";
import RightPanel from "@/components/Layout/RightPanel";
import { AIFeedbackButton } from "@/components/Ui/buttons";
import FloatingChatButton from "@/components/Chat/FloatingChatButton";
import TodoSticker, { TodoStickerToggle } from "@/components/TodoSticker/TodoSticker";
import UploadModal from "@/components/Modals/UploadModal";
import TemplateModal from "@/components/Modals/TemplateModal";
import AIFeedbackModal from "@/components/Modals/AIFeedbackModal";
import { WorkspaceMembersModal } from "@/components/Modals/WorkspaceMembersModal";

/**
 * CanvasView - Canvas.tsx와 동일한 구조의 캔버스 뷰 컴포넌트
 * 
 * 주요 역할:
 * 1. Canvas.tsx와 완전히 동일한 레이아웃 구조 제공
 * 2. 좌측 사이드바, 중앙 캔버스 영역, 우측 패널 관리
 * 3. 플로팅 요소들 (AI 채팅, 피드백, Todo) 통합
 * 
 * 핵심 특징:
 * - 컴포넌트 분리를 통한 모듈화된 구조
 * - Canvas.tsx와 동일한 상태 관리 패턴
 * - 모든 모달과 플로팅 요소 통합 관리
 * 
 * 주의사항:
 * - Canvas.tsx의 구조를 정확히 따라야 함
 * - 모든 핸들러는 Canvas.tsx와 동일한 시그니처 유지
 * - 컴포넌트 props는 기존 Layout 컴포넌트들과 호환되어야 함
 */

// Canvas.tsx와 동일한 타입 정의
type Asset = any; // 실제 Asset 타입은 shared/schema.ts에서 가져와야 함

interface CanvasViewProps {
  canvas: {
    id: string;
    title: string;
    workspace_id: string;
    workspaceId: string;
    created_by: string;
    is_public?: boolean;
  };
  canvasState?: any;
  isPublic?: boolean;
}

export function CanvasView({ canvas, canvasState, isPublic = false }: CanvasViewProps) {
  const { toast } = useToast();
  
  // UI State - Canvas.tsx와 동일한 구조
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [uploadType, setUploadType] = useState<"pdf" | "youtube" | "url">("pdf");
  
  // Node details state for right panel
  const [showNodeDetails, setShowNodeDetails] = useState(false);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<any>(null);
  
  // Todo sticker state
  const [showTodoSticker, setShowTodoSticker] = useState(true);

  // Handlers - Canvas.tsx와 동일한 구조
  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setShowRightPanel(true);
  };

  const handleCloseRightPanel = () => {
    setSelectedNodeId(null);
    setShowRightPanel(false);
  };

  const handleNodeDoubleClick = (node: any) => {
    // Show in right panel instead of sidebar
    setSelectedNodeId(node.id);
    setShowRightPanel(true);
  };

  const handleCloseNodeDetails = () => {
    setShowNodeDetails(false);
    setSelectedNodeDetails(null);
  };

  const handleOpenUploadModal = (type: "pdf" | "youtube" | "url") => {
    setUploadType(type);
    setShowUploadModal(true);
  };

  const handleOpenMembersModal = () => {
    setShowMembersModal(true);
  };

  const handleRequestAIFeedback = () => {
    setShowAIModal(true);
  };



  // Assets state - workspace/canvas별 업로드 자료
  const [assets, setAssets] = useState<Asset[]>([]);
  const workspaceId = canvas.workspaceId || canvas.workspace_id;

  // Fetch assets from API normalized to Asset shape
  useEffect(() => {
    if (!workspaceId || !canvas.id) return;

    let isMounted = true;

    const fetchAssets = async () => {
      try {
        const res = await fetch(`/api/workspaces/${workspaceId}/assets?canvasId=${canvas.id}`, {
          credentials: 'include',
        });
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) setAssets(Array.isArray(data) ? data : []);
      } catch (err) {
        // 무시하고 다음 시도에서 다시 시도
      }
    };

    fetchAssets();

    // Realtime subscription for canvas_knowledge changes
    const supabase = createClient();
    const channel = supabase
      .channel(`canvas-knowledge-${canvas.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'canvas_knowledge',
          filter: `canvas_id=eq.${canvas.id}`,
        },
        () => {
          // Refetch assets on insert/update/delete
          fetchAssets();
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [workspaceId, canvas.id]);

  return (
    <div className="flex min-h-screen h-screen bg-gray-50 overflow-hidden w-full max-w-full">
      {/* Left Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenUploadModal={handleOpenUploadModal}
        onOpenTemplateModal={() => setShowTemplateModal(true)}
        onOpenMembersModal={handleOpenMembersModal}
        assets={assets}
        workspaceId={canvas.workspaceId || canvas.workspace_id}
        workspaceName={canvas.title}
        selectedNode={selectedNodeDetails}
        showNodeDetails={showNodeDetails}
        onCloseNodeDetails={handleCloseNodeDetails}
      />

      {/* Main Canvas Area */}
      <CanvasArea
        canvas={canvas}
        canvasState={canvasState}
        selectedNodeId={selectedNodeId}
        onNodeSelect={handleNodeSelect}
        onNodeDoubleClick={handleNodeDoubleClick}
        isReadOnly={isPublic}
      />

      {/* Right Panel */}
      {showRightPanel && selectedNodeId && (
        <RightPanel
          nodeId={selectedNodeId}
          canvasId={canvas.id}
          onClose={handleCloseRightPanel}
        />
      )}

      {/* AI Feedback Button */}
      <AIFeedbackButton onRequestFeedback={handleRequestAIFeedback} />

      {/* Floating Chat Button */}
      <FloatingChatButton canvasId={canvas.id} isReadOnly={isPublic} />

      {/* Todo Sticker */}
      {showTodoSticker ? (
        <TodoSticker 
          canvasId={canvas.id} 
          onHide={() => setShowTodoSticker(false)}
        />
      ) : (
        <TodoStickerToggle 
          canvasId={canvas.id} 
          onShow={() => setShowTodoSticker(true)} 
        />
      )}

      {/* Modals */}
      <UploadModal
        open={showUploadModal}
        onOpenChange={setShowUploadModal}
        uploadType={uploadType}
        workspaceId={canvas.workspaceId || canvas.workspace_id}
        canvasId={canvas.id}
      />

      <TemplateModal
        open={showTemplateModal}
        onOpenChange={setShowTemplateModal}
        canvasId={canvas.id}
      />

      <AIFeedbackModal
        open={showAIModal}
        onOpenChange={setShowAIModal}
        canvasId={canvas.id}
      />

      <WorkspaceMembersModal
        isOpen={showMembersModal}
        onClose={() => setShowMembersModal(false)}
        workspaceId={canvas.workspaceId || canvas.workspace_id}
        workspaceName={canvas.title}
      />
    </div>
  );
}
