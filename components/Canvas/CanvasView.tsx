"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

import Sidebar from "@/components/Layout/Sidebar";
import CanvasArea from "@/components/Layout/CanvasArea";
import NodeDetailsPanel from "@/components/Node/NodeDetailsPanel";
import SidebarChat from "@/components/Chat/SidebarChat";
import TodoSticker, { TodoStickerToggle } from "@/components/TodoSticker/TodoSticker";
import UploadModal from "@/components/Modals/UploadModal";
import { CanvasShareModal } from "@/components/Modals/CanvasShareModal";
import CanvasOnboardingModal from "@/components/Modals/CanvasOnboardingModal";
import { useCanvasRole } from "@/hooks/useCanvasRole";
import { useCanvasOnboarding } from "@/hooks/useCanvasOnboarding";
import type { CanvasViewProps, CanvasAreaCanvas, FlowNode } from "@/types/canvas";
import type { Asset } from "@shared/schema";
import { toCanvasAreaCanvas } from "@/types/canvas";

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

// 타입 정의는 types/canvas.ts에서 가져옴

export function CanvasView({ canvas, canvasState, isPublic = false, readOnly = false }: CanvasViewProps) {
  const { toast } = useToast();
  const { role, canEdit } = useCanvasRole(canvas.id);
  
  // UI State - Canvas.tsx와 동일한 구조
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  
  const [showRightPanel, setShowRightPanel] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCanvasShareModal, setShowCanvasShareModal] = useState(false);
  const [uploadType, setUploadType] = useState<"pdf" | "youtube" | "url" | "text">("pdf");
  
  // Node details state for right panel
  const [showNodeDetails, setShowNodeDetails] = useState(false);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState<FlowNode | null>(null);
  
  // Todo sticker state - 기본은 닫힘. 사용자 설정을 localStorage에서 복원
  const [showTodoSticker, setShowTodoSticker] = useState(false);

  // 첫 로드 시 저장된 가시성 상태 복원 (캔버스별)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`todo-visible-${canvas.id}`);
      if (stored !== null) {
        setShowTodoSticker(stored === 'true');
      }
    } catch (_) {
      // ignore storage errors
    }
  }, [canvas.id]);

  // 상태 변경 시 저장
  useEffect(() => {
    try {
      localStorage.setItem(`todo-visible-${canvas.id}`, String(showTodoSticker));
    } catch (_) {
      // ignore storage errors
    }
  }, [showTodoSticker, canvas.id]);
  
  // Chat sidebar state - 기본은 닫힌 상태로 시작
  const [chatCollapsed, setChatCollapsed] = useState(true);

  // Onboarding state (auto open on first canvas creation)
  const {
    isOpen: isOnboardingOpen,
    step: onboardingStep,
    open: openOnboarding,
    close: closeOnboarding,
    startChat: startOnboardingChat,
    skipOnboarding,
    messages: onboardingMessages,
    inputText: onboardingInput,
    setInputText: setOnboardingInput,
    isSending: isOnboardingSending,
    isTyping: isOnboardingTyping,
    assistantSuggestedFinalize,
    sendMessage: sendOnboardingMessage,
    isFinalizing: isOnboardingFinalizing,
    finalize: finalizeOnboarding,
    summary: onboardingSummary,
    isCreateEnabled: isOnboardingCreateEnabled,
    applyDraftToCanvas,
  } = useCanvasOnboarding(canvas.id, {
    autoOpenIfFirstTime: true,
    canEdit,
    hasInitialState: Boolean(((canvasState as any)?.state?.nodes?.length) || 0),
  });

  // Handlers - Canvas.tsx와 동일한 구조
  const handleNodeSelect = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setShowRightPanel(true);
  };

  const handleCloseRightPanel = () => {
    setSelectedNodeId(null);
    setShowRightPanel(false);
  };

  const handleNodeDoubleClick = (node: FlowNode) => {
    // Show in right panel instead of sidebar
    setSelectedNodeId(node.id);
    setShowRightPanel(true);
  };

  const handleCloseNodeDetails = () => {
    setShowNodeDetails(false);
    setSelectedNodeDetails(null);
  };

  const handleOpenUploadModal = (type: "pdf" | "youtube" | "url" | "text") => {
    setUploadType(type);
    setShowUploadModal(true);
  };

  const handleOpenMembersModal = () => {
    setShowCanvasShareModal(true);
  };


  const handleToggleChatSidebar = () => {
    setChatCollapsed(!chatCollapsed);
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

  // Optimistic removal handler passed to Sidebar
  const handleAssetDeleted = (assetId: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
  };

  return (
    <div className="flex min-h-screen h-screen bg-gray-50 overflow-hidden w-full max-w-full relative">
      {/* Left Sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        onOpenUploadModal={handleOpenUploadModal}
        onOpenMembersModal={handleOpenMembersModal}
        assets={assets}
        workspaceId={canvas.workspaceId || canvas.workspace_id || ''}
        workspaceName={canvas.title}
        selectedNode={selectedNodeDetails}
        showNodeDetails={showNodeDetails}
        onCloseNodeDetails={handleCloseNodeDetails}
        onAssetDeleted={handleAssetDeleted}
        disableKnowledgeUpload={role === 'viewer'}
        disableCanvasManage={role === 'viewer' || role === 'editor'}
      />

      {/* Main Canvas Area */}
      <CanvasArea
        canvas={toCanvasAreaCanvas(canvas)}
        canvasState={canvasState}
        selectedNodeId={selectedNodeId}
        onNodeSelect={handleNodeSelect}
        onNodeDoubleClick={handleNodeDoubleClick}
        isReadOnly={isPublic || !canEdit}
      />

      {/* Right Panel - 노드가 선택된 경우 우선 표시 */}
      {showRightPanel && selectedNodeId ? (
        <NodeDetailsPanel
          nodeId={selectedNodeId}
          canvasId={canvas.id}
          onClose={handleCloseRightPanel}
        />
      ) : (
        /* Chat Sidebar - 항상 고정으로 표시 */
        <SidebarChat 
          canvasId={canvas.id} 
          isReadOnly={isPublic}
          onToggle={handleToggleChatSidebar}
          isCollapsed={chatCollapsed}
        />
      )}


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
        workspaceId={canvas.workspaceId || canvas.workspace_id || ''}
        canvasId={canvas.id}
      />

      <CanvasShareModal
        isOpen={showCanvasShareModal}
        onClose={() => setShowCanvasShareModal(false)}
        canvasId={canvas.id}
        canvasTitle={canvas.title}
      />

      {/* Onboarding Modal - 최초 생성 시 */}
      {!isPublic && canEdit && (
        <CanvasOnboardingModal
          isOpen={isOnboardingOpen}
          step={onboardingStep as any}
          onClose={closeOnboarding}
          onSkip={skipOnboarding}
          onStartChat={startOnboardingChat}
          messages={onboardingMessages as any}
          inputText={onboardingInput}
          onChangeInput={setOnboardingInput}
          onSendMessage={sendOnboardingMessage}
          isSending={isOnboardingSending}
          isTyping={isOnboardingTyping}
          assistantSuggestedFinalize={assistantSuggestedFinalize}
          onFinalize={finalizeOnboarding}
          isFinalizing={isOnboardingFinalizing}
          summary={onboardingSummary}
          isCreateEnabled={isOnboardingCreateEnabled}
          onCreateDraft={applyDraftToCanvas}
        />
      )}
    </div>
  );
}
