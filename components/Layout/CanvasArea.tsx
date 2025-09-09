import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CanvasHeader, ProfileBadge } from "@/components/Canvas/CanvasHeader";
import { useProfile } from "@/hooks/useAuth";
import { CanvasEdges } from "@/components/Canvas/CanvasEdges";
import FunnelNode from "@/components/Canvas/FunnelNode";
import NodeCreationModal from "@/components/Canvas/NodeCreationModal";
import { TextMemo } from "@/components/Canvas/TextMemo";
import { useToast } from "@/hooks/use-toast";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useCanvasInteractions } from "@/hooks/use-canvas-interactions";
import { useCanvasSync } from "@/hooks/useCanvasSync";
import { createToastMessage } from "@/lib/messages/toast-utils";
import { invalidateCanvasQueries } from "@/lib/queryClient";
import { Mail, Monitor, Share, MessageSquare } from "lucide-react";
import type { Canvas, CanvasState } from "@shared/schema";
import type { FlowNode, FlowEdge, TextMemoData } from "@/types/canvas";
import { createClient as createSupabaseClient } from "@/lib/supabase/client";

interface CanvasAreaProps {
  canvas: Canvas;
  canvasState?: CanvasState;
  selectedNodeId: string | null;
  onNodeSelect: (nodeId: string) => void;
  onNodeDoubleClick?: (node: FlowNode) => void;
  onAddNode?: (nodeType: string) => void;
  isReadOnly?: boolean;
  externalMemos?: TextMemoData[];
}

// Node 타입은 types/canvas.ts의 FlowNode를 사용

// Edge 타입은 types/canvas.ts의 FlowEdge를 사용

interface Memo {
  id: string;
  content: string;
  position: { x: number; y: number };
  size?: { width: number; height: number };
}

export default function CanvasArea({
  canvas,
  canvasState,
  selectedNodeId,
  onNodeSelect,
  onNodeDoubleClick,
  onAddNode,
  isReadOnly = false,
  externalMemos,
  
}: CanvasAreaProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // 프로필 정보 가져오기
  const { profile } = useProfile();
  
  // Canvas viewport state for zoom and pan (Zustand)
  const viewport = useCanvasStore(s => s.viewport);
  const setViewport = useCanvasStore(s => s.setViewport);
  
  // Dragging state for canvas pan (Zustand)
  const isPanning = useCanvasStore(s => s.isPanning);
  const setIsPanning = useCanvasStore(s => s.setIsPanning);
  const panStart = useCanvasStore(s => s.panStart);
  const setPanStart = useCanvasStore(s => s.setPanStart);
  const lastPanPoint = useCanvasStore(s => s.lastPanPoint);
  const setLastPanPoint = useCanvasStore(s => s.setLastPanPoint);
  
  // Node dragging state (Zustand)
  const draggedNodeId = useCanvasStore(s => s.draggedNodeId);
  const setDraggedNodeId = useCanvasStore(s => s.setDraggedNodeId);
  const nodeDragStart = useCanvasStore(s => s.nodeDragStart);
  const setNodeDragStart = useCanvasStore(s => s.setNodeDragStart);
  const nodePositions = useCanvasStore(s => s.nodePositions);
  const setNodePositions = useCanvasStore(s => s.setNodePositions);
  
  // Connection state (Zustand)
  const isConnecting = useCanvasStore(s => s.isConnecting);
  const setIsConnecting = useCanvasStore(s => s.setIsConnecting);
  const connectionStart = useCanvasStore(s => s.connectionStart);
  const setConnectionStart = useCanvasStore(s => s.setConnectionStart);
  const temporaryConnection = useCanvasStore(s => s.temporaryConnection);
  const setTemporaryConnection = useCanvasStore(s => s.setTemporaryConnection);
  const connectionStartAnchor = useCanvasStore(s => (s as any).connectionStartAnchor);
  const setConnectionStartAnchor = useCanvasStore(s => (s as any).setConnectionStartAnchor);
  
  // Node creation modal state
  const [showNodeCreationModal, setShowNodeCreationModal] = useState(false);
  const [nodeCreationPosition, setNodeCreationPosition] = useState({ x: 0, y: 0 });
  
  // Text memos state
  const [memos, setMemos] = useState<Memo[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  // 엣지 관련 UI 상태는 CanvasEdges로 이전됨
  

  // 무료 플랜 합계 제한(노드+메모+할일) 사전 검사 유틸
  const MAX_FREE_ITEMS = 10;
  const getCurrentTotalItems = useCallback(async () => {
    try {
      // 노드와 메모는 로컬 상태 기반 계산
      const nodesCount = (useCanvasStore.getState().nodes || []).length;
      const memosCount = memos.length;
      // 할일 개수는 API로 간단 조회
      const res = await fetch(`/api/canvases/${canvas.id}/todos`, { credentials: 'include' });
      let todosCount = 0;
      if (res.ok) {
        try { const arr = await res.json(); todosCount = Array.isArray(arr) ? arr.length : 0; } catch {}
      }
      return nodesCount + memosCount + todosCount;
    } catch {
      // 실패 시 보수적으로 로컬만 계산
      const nodesCount = (useCanvasStore.getState().nodes || []).length;
      const memosCount = memos.length;
      return nodesCount + memosCount;
    }
  }, [canvas.id, memos.length]);

  const ensureNotOverFreeLimit = useCallback(async (adding: number) => {
    const total = await getCurrentTotalItems();
    if (total + adding > MAX_FREE_ITEMS) {
      toast({
        title: '무료 플랜 제한',
        description: '노드+메모+할일 합계는 10개까지 가능합니다. Pro로 업그레이드 해주세요.',
        variant: 'destructive'
      });
      return false;
    }
    return true;
  }, [getCurrentTotalItems, toast]);

  
  // 임시 메모 처리용 큐/플래그
  const tempMemoPendingRef = useRef<Record<string, { position?: { x: number; y: number }; size?: { width: number; height: number }; content?: string }>>({});
  const tempDeletedIdsRef = useRef<Set<string>>(new Set());
  const isTempId = useCallback((id: string) => id.startsWith('temp-'), []);
  // Title 업데이트 콜백 (헤더에 전달)
  const updateCanvasTitle = useCallback(async (newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed || trimmed === canvas.title) return;
    try {
      const response = await fetch(`/api/canvases/${canvas.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: trimmed })
      });
      if (!response.ok) {
        // API 실패 시 클라이언트 Supabase 세션으로 대체 업데이트 시도 (RLS 정책 충족 시)
        const supabase = createSupabaseClient();
        const { data: updatedRow, error } = await (supabase as any)
          .from('canvases')
          .update({ title: trimmed })
          .eq('id', canvas.id)
          .select('*')
          .single();
        if (error || !updatedRow) {
          throw new Error(`Failed to update canvas title${error?.message ? `: ${error.message}` : ''}`);
        }
      }
      // 성공 시 관련 목록/상세 쿼리 무효화
      await queryClient.invalidateQueries({ queryKey: ["/api/canvases", canvas.id] });
      await queryClient.invalidateQueries({ queryKey: ["/api/workspaces", canvas.workspaceId, "canvases"] });
      // 최종적으로 상세 재조회 트리거(있다면)
      await queryClient.refetchQueries({ queryKey: ["/api/canvases", canvas.id] });
      // 사용자 피드백
      const successMessage = createToastMessage.canvasSuccess('TITLE_UPDATE', trimmed);
      toast(successMessage);
    } catch (error) {
      console.error("Failed to update canvas title:", error);
      const errorMessage = createToastMessage.canvasError(error, 'UPDATE');
      toast(errorMessage);
      // 상위 컴포넌트가 편집 상태를 유지하도록 에러 전파
      throw error;
    }
  }, [canvas.id, canvas.title, canvas.workspaceId, queryClient, toast]);



  // Get nodes and edges from canvas state, or use empty defaults
  const flowData = useMemo(() => {
    if (canvasState?.state) {
      const data = canvasState.state as any;
      console.log('📊 Flow data extracted:', {
        nodes: data.nodes?.length || 0,
        edges: data.edges?.length || 0,
        canvasStateId: canvasState.id,
        isReadOnly,
        rawData: data
      });
      return data;
    }
    console.log('📊 No flow data found, using empty:', { canvasState, isReadOnly });
    return { nodes: [], edges: [] };
  }, [canvasState, isReadOnly]);
  


  const localNodes = useCanvasStore(s => s.nodes);
  const setLocalNodes = useCanvasStore(s => s.setNodes);
  const addNode = useCanvasStore(s => s.addNode);
  
  // Update local nodes when canvas state changes
  useEffect(() => {
    if (canvasState?.state && (canvasState.state as any)?.nodes) {
      const nodes = (canvasState.state as any).nodes;
      setLocalNodes(nodes);
    } else if (flowData?.nodes) {
      setLocalNodes(flowData.nodes);
    }
  }, [canvasState, flowData, setLocalNodes]);
  
  const baseNodes: FlowNode[] = localNodes;
  
  // State for managing edges with multi-connection support
  const edges = useCanvasStore(s => s.edges);
  const setEdges = useCanvasStore(s => s.setEdges);
  
  // Update edges when canvas state changes
  useEffect(() => {
    if (canvasState?.state && (canvasState.state as any)?.edges) {
      const edges = (canvasState.state as any).edges;
      setEdges(edges);
    } else if (flowData?.edges) {
      setEdges(flowData.edges);
    }
  }, [canvasState, flowData, setEdges]);
  
  // Update memos when canvas state changes
  useEffect(() => {
    if ((flowData as any)?.memos) {
      setMemos((flowData as any).memos);
    }
  }, [flowData]);
  
  // Merge base positions with dynamic positions (memoized)
  const nodes: FlowNode[] = useMemo(() => (
    baseNodes.map(node => ({
      ...node,
      position: nodePositions[node.id] || node.position
    }))
  ), [baseNodes, nodePositions]);
  
  // Additional fallback: if localNodes is empty but flowData has nodes, use flowData directly
  // For read-only mode, always prioritize flowData if localNodes is empty
  const finalNodes = useMemo(() => (
    nodes.length > 0 ? nodes : (flowData?.nodes || [])
  ), [nodes, flowData]);
  
  // CRITICAL FIX: Deterministic node rendering for read-only mode
  const renderNodes = useMemo(() => {
    if (isReadOnly) {
      // Debug logging for read-only mode
      console.log('🔍 ReadOnly Debug:', {
        isReadOnly,
        flowData,
        flowDataNodes: flowData?.nodes,
        nodeCount: flowData?.nodes?.length || 0,
        canvasState: canvasState
      });
      
      const srcNodes = flowData?.nodes ?? [];
      const processedNodes = (srcNodes || []).map((node: FlowNode) => ({
        ...node,
        position: {
          x: Number.isFinite(node?.position?.x) ? node.position.x : 50,
          y: Number.isFinite(node?.position?.y) ? node.position.y : 50,
        },
        draggable: false,
        selectable: false,
      }));
      
      console.log('🔍 Processed nodes:', processedNodes);
      return processedNodes;
    }
    
    return (finalNodes || []).map((node: FlowNode) => ({
      ...node,
      position: {
        x: Number.isFinite(node?.position?.x) ? node.position.x : 50,
        y: Number.isFinite(node?.position?.y) ? node.position.y : 50,
      },
      draggable: false,
      selectable: false,
    }));
  }, [isReadOnly, flowData, finalNodes, canvasState]);

  // CRITICAL FIX: Proper viewport initialization for read-only mode
  useEffect(() => {
    if (isReadOnly && flowData?.nodes && flowData.nodes.length > 0) {
      // For read-only mode, use a simple fixed viewport that ensures all nodes are visible
      const simpleViewport = {
        x: 0,
        y: 0,
        zoom: 1
      };
      
      setViewport(simpleViewport);
    }
  }, [isReadOnly, flowData, setViewport]);

  // Zustand 기반 디바운스 저장 훅 + 수동 저장 토스트 표시
  const manualSavePendingRef = useRef(false);
  const { triggerSave, saving, lastSavedAt } = useCanvasSync(canvas.id, {
    debounceMs: 1000,
    enabled: !isReadOnly,
    onSuccess: () => {
      // 최신 상태 쿼리 무효화
      invalidateCanvasQueries({ canvasId: canvas.id, client: queryClient, targets: ["state"] });
      if (manualSavePendingRef.current) {
        const successMessage = createToastMessage.canvasSuccess('SAVE');
        toast(successMessage);
        manualSavePendingRef.current = false;
      }
    },
    onError: (error, context) => {
      const info: any = context?.info;
      const message = info?.error || info?.message || (error instanceof Error ? error.message : '저장 중 오류가 발생했습니다.');
      // 무료 플랜 제한에 걸리면 사용자에게 명확히 안내
      toast({ title: '저장 실패', description: message, variant: 'destructive' });
      manualSavePendingRef.current = false;
    }
  });

  // 노드 추가 함수
  const handleAddNodeToCanvas = useCallback(async (nodeType: string) => {
    if (isReadOnly) return;
    // 사전 제한 검사 (노드 1개 추가)
    const ok = await ensureNotOverFreeLimit(1);
    if (!ok) return;

    const getNodeConfig = (type: string) => {
      const configs = {
        landing: { 
          title: 'Landing Page', 
          icon: '🏠', 
          color: '#3B82F6',
          size: 'large' as const,
          subtitle: '방문자를 맞이하는 첫 페이지'
        },
        form: { 
          title: 'Form', 
          icon: '📝', 
          color: '#10B981',
          size: 'medium' as const,
          subtitle: '정보 수집 양식'
        },
        email: { 
          title: 'Email', 
          icon: '📧', 
          color: '#8B5CF6',
          size: 'medium' as const,
          subtitle: '이메일 발송'
        },
        checkout: { 
          title: 'Checkout', 
          icon: '🛒', 
          color: '#F59E0B',
          size: 'large' as const,
          subtitle: '결제 및 주문 완료'
        },
        thankyou: { 
          title: 'Thank You', 
          icon: '✅', 
          color: '#EF4444',
          size: 'medium' as const,
          subtitle: '감사 인사 페이지'
        },
        data: { 
          title: 'Data Source', 
          icon: '💾', 
          color: '#06B6D4',
          size: 'small' as const,
          subtitle: '데이터 연결점'
        },
        analysis: { 
          title: 'Analysis', 
          icon: '📊', 
          color: '#6366F1',
          size: 'medium' as const,
          subtitle: '데이터 분석 결과'
        },
      };
      return configs[type as keyof typeof configs] || configs.landing;
    };

    const config = getNodeConfig(nodeType);
    const newNode: FlowNode = {
      id: `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: nodeType,
      data: {
        title: config.title,
        subtitle: config.subtitle,
        icon: config.icon,
        color: config.color,
        size: config.size,
      },
      position: {
        x: Math.random() * 400 + 100, // 랜덤 위치 (100-500px)
        y: Math.random() * 300 + 100, // 랜덤 위치 (100-400px)
      },
    };

    // 전역 스토어 노드 추가
    addNode(newNode);
    // 디바운스 저장
    triggerSave("add-node");

    const successMessage = createToastMessage.canvasSuccess('NODE_ADD', config.title);
    toast(successMessage);
  }, [isReadOnly, addNode, triggerSave, toast, ensureNotOverFreeLimit]);

  // onAddNode prop이 있으면 실제 노드 추가 함수로 연결
  useEffect(() => {
    if (onAddNode) {
      // onAddNode를 실제 구현으로 대체
      (window as any).handleAddNodeToCanvas = handleAddNodeToCanvas;
    }
  }, [onAddNode, handleAddNodeToCanvas]);



  // 캔버스 인터랙션 훅 사용 (패닝/줌/드래그 성능 최적화)
  const { handleCanvasMouseDown, handleCanvasPointerDown, handleNodeMouseDown, handleNodePointerDown, handleWheel, livePositionsRef } = useCanvasInteractions({
    canvasRef,
    viewport,
    setViewport,
    nodes: renderNodes,
    setNodePositions,
    triggerSave,
    isReadOnly,
  });

  // Connection start from connection point
  const handleConnectionStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConnecting(true);
    setConnectionStart(nodeId);
    // Detect anchor from data attribute on the clicked handle
    let anchor: 'left' | 'right' | 'top' | 'bottom' = 'right';
    const targetEl = e.currentTarget as HTMLElement;
    const dataAnchor = targetEl.getAttribute('data-anchor') || (targetEl.closest('.connection-point') as HTMLElement | null)?.getAttribute('data-anchor');
    if (dataAnchor === 'left' || dataAnchor === 'right' || dataAnchor === 'top' || dataAnchor === 'bottom') {
      anchor = dataAnchor;
    }
    setConnectionStartAnchor(anchor);
    
    // Get the source node position for smooth temporary line
    const sourceNode = nodes.find(n => n.id === nodeId);
    if (sourceNode) {
      const rect = (e.target as HTMLElement).closest('.canvas-content')?.getBoundingClientRect();
      if (rect) {
        // Initialize temp connection at current mouse position (converted to canvas coordinates)
        setTemporaryConnection({ 
          x: (e.clientX - rect.left - viewport.x) / viewport.zoom, 
          y: (e.clientY - rect.top - viewport.y) / viewport.zoom
        });
      }
    }
  }, [nodes, viewport.x, viewport.y, viewport.zoom, setIsConnecting, setConnectionStart, setTemporaryConnection, setConnectionStartAnchor]);

  const handleNodeMouseUp = useCallback((nodeId: string) => {
    
    if (isConnecting && connectionStart && connectionStart !== nodeId) {
      // Check if connection already exists
      const connectionExists = edges.some(edge => 
        edge.source === connectionStart && edge.target === nodeId
      );
      
      if (!connectionExists) {
        // Create new connection (multi-connection support)
        const newEdge: FlowEdge = {
          id: `edge-${connectionStart}-${nodeId}-${Date.now()}`,
          source: connectionStart,
          target: nodeId,
          data: {
            sourceAnchor: (connectionStartAnchor as any) || 'right',
            // Decide target anchor based on relative positions and orientation
            targetAnchor: (() => {
              const sourceNode = nodes.find(n => n.id === connectionStart);
              const targetNode = nodes.find(n => n.id === nodeId);
              if (sourceNode && targetNode) {
                const src = sourceNode.position;
                const tgt = targetNode.position;
                const isVertical = connectionStartAnchor === 'top' || connectionStartAnchor === 'bottom';
                if (isVertical) {
                  return tgt.y >= src.y ? 'top' : 'bottom';
                }
                return 'left';
              }
              return 'left';
            })()
          }
        };
        
        // Update edges state
        const newEdges = [...edges, newEdge];
        setEdges(newEdges);
        console.log(`Created connection from ${connectionStart} to ${nodeId}`);
        
        // 저장 트리거 (즉시 저장)
        triggerSave("connect", true);
        
      } else {
        console.log(`Connection already exists from ${connectionStart} to ${nodeId}`);
      }
    }
    
    setIsConnecting(false);
    setConnectionStart(null);
    setTemporaryConnection(null);
    setConnectionStartAnchor(null as any);
    setDraggedNodeId(null);
  }, [isConnecting, connectionStart, edges, setIsConnecting, setConnectionStart, setTemporaryConnection, setDraggedNodeId, setEdges, triggerSave, connectionStartAnchor, nodes, setConnectionStartAnchor]);

  // React Query mutation 제거: useCanvasSync로 통일

  // Node deletion handler
  const handleNodeDelete = useCallback((nodeId: string) => {
    // Delete the node
    const newNodes = localNodes.filter(node => node.id !== nodeId);
    setLocalNodes(newNodes);
    
    // Delete all edges connected to this node
    const newEdges = edges.filter(edge => 
      edge.source !== nodeId && edge.target !== nodeId
    );
    setEdges(newEdges);
    
    // Remove from position tracking
    setNodePositions(prev => {
      const newPositions = { ...prev };
      delete newPositions[nodeId];
      return newPositions;
    });
    
    // Clear selection if deleted node was selected
    if (selectedNodeId === nodeId) {
      onNodeSelect('');
    }
    
    // 저장 트리거 (즉시 저장)
    triggerSave("delete-node", true);
    
    console.log(`Deleted node: ${nodeId} and its connections`);
  }, [localNodes, edges, selectedNodeId, onNodeSelect, triggerSave, setLocalNodes, setEdges, setNodePositions]);

  // Canvas pan handlers
  // Drag and drop handlers for adding new nodes
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (data.type === 'node') {
        // 사전 제한 검사 (노드 1개 추가)
        const ok = await ensureNotOverFreeLimit(1);
        if (!ok) return;
        // Calculate drop position relative to canvas
        const rect = (e.target as HTMLElement).closest('.canvas-content')?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left - viewport.x) / viewport.zoom - 80; // Center the node
          const y = (e.clientY - rect.top - viewport.y) / viewport.zoom - 40;
          
          // Create new node with unique ID
          const newNode: FlowNode = {
            id: `${data.nodeType}-${Date.now()}`,
            type: data.nodeType,
            data: data.data,
            position: { x, y }
          };
          
          const currentNodes = (useCanvasStore.getState().nodes || []) as FlowNode[];
          setLocalNodes([...currentNodes, newNode]);
          console.log(`Added new ${data.nodeType} node at (${x}, ${y})`);
          triggerSave("drop-node");
        }
      }
    } catch (error) {
      console.error('Error parsing drag data:', error);
    }
  }, [viewport.x, viewport.y, viewport.zoom, setLocalNodes, triggerSave, ensureNotOverFreeLimit]);

  // Helper function to get canvas-relative coordinates
  const getCanvasCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - viewport.x) / viewport.zoom;
    const y = (clientY - rect.top - viewport.y) / viewport.zoom;
    
    return { x, y };
  }, [viewport.x, viewport.y, viewport.zoom]);

  // 기존 패닝 시작 핸들러 제거 → 훅에서 처리

  // Memo management functions
  const createNewMemo = useCallback(async (x: number, y: number) => {
    // 사전 제한 검사 (메모 1개 추가)
    const ok = await ensureNotOverFreeLimit(1);
    if (!ok) return;
    try {
      // 낙관적 추가: 임시 메모를 즉시 UI에 표시
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tempMemo: Memo = {
        id: tempId,
        content: "새 메모",
        position: { x, y },
        size: { width: 280, height: 180 }
      };
      setMemos(prev => [...prev, tempMemo]);
      setSelectedMemoId(tempId);

      const response = await fetch(`/api/canvases/${canvas.id}/memos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: "새 메모",
          position: { x, y }
        })
      });

      if (response.ok) {
        const newMemo = await response.json();
        // 임시 메모가 생성 완료 전에 삭제되었는지 확인
        const wasDeleted = tempDeletedIdsRef.current.has(tempId);
        if (wasDeleted) {
          // 서버에 즉시 삭제 요청 전송
          await fetch(`/api/canvases/${canvas.id}/memos/${newMemo.id}`, {
            method: 'DELETE',
            credentials: 'include'
          });
          tempDeletedIdsRef.current.delete(tempId);
          // UI에서는 이미 제거됨
          return;
        }

        // 큐잉된 변경사항 적용(내용/위치/크기)
        const pending = tempMemoPendingRef.current[tempId];
        let merged = newMemo as Memo;
        if (pending?.content) {
          try { await fetch(`/api/canvases/${canvas.id}/memos/${newMemo.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: pending.content, position: pending.position || newMemo.position }) }); } catch {}
          merged = { ...merged, content: pending.content };
        }
        if (pending?.position) {
          try { await fetch(`/api/canvases/${canvas.id}/memos/${newMemo.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ position: pending.position, content: pending.content || newMemo.content }) }); } catch {}
          merged = { ...merged, position: pending.position } as Memo;
        }
        if (pending?.size) {
          try { await fetch(`/api/canvases/${canvas.id}/memos/${newMemo.id}`, { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ size: pending.size }) }); } catch {}
          merged = { ...merged, size: pending.size } as Memo;
        }
        delete tempMemoPendingRef.current[tempId];

        // 임시 메모를 실제 서버 응답 메모로 교체 + 병합된 변경 반영
        setMemos(prev => prev.map(m => m.id === tempId ? merged : m));
        setSelectedMemoId(merged.id);
      } else {
        // 실패 시 임시 메모 제거
        setMemos(prev => prev.filter(m => m.id !== tempId));
      }
    } catch (error) {
      console.error("Error creating memo:", error);
      // 에러 시 임시 메모 제거 (실패 복구)
      setMemos(prev => prev.filter(m => !m.id.startsWith('temp-')));
    }
  }, [canvas.id, ensureNotOverFreeLimit]);

  const updateMemo = useCallback(async (memoId: string, content: string) => {
    try {
      const memo = memos.find(m => m.id === memoId);
      if (!memo) return;

      // 임시 메모는 서버 호출 대신 로컬 업데이트 + 큐잉
      if (isTempId(memoId)) {
        setMemos(prev => prev.map(m => m.id === memoId ? { ...m, content } : m));
        tempMemoPendingRef.current[memoId] = {
          ...(tempMemoPendingRef.current[memoId] || {}),
          content
        };
        return;
      }

      const response = await fetch(`/api/canvases/${canvas.id}/memos/${memoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content,
          position: memo.position
        })
      });

      const updatedMemo = await response.json();
      setMemos(prev => prev.map(m => m.id === memoId ? updatedMemo : m));
    } catch (error) {
      console.error("Error updating memo:", error);
    }
  }, [canvas.id, memos, isTempId]);

  const deleteMemo = useCallback(async (memoId: string) => {
    try {
      // 삭제 전에 보류 중인 위치/크기 업데이트 타이머 정리
      if (memoUpdateTimeoutsRef.current[memoId]) {
        clearTimeout(memoUpdateTimeoutsRef.current[memoId]);
        delete memoUpdateTimeoutsRef.current[memoId];
      }
      if (pendingMemoUpdatesRef.current[memoId]) {
        delete pendingMemoUpdatesRef.current[memoId];
      }
      if (memoSizeUpdateTimeoutsRef.current[memoId]) {
        clearTimeout(memoSizeUpdateTimeoutsRef.current[memoId]);
        delete memoSizeUpdateTimeoutsRef.current[memoId];
      }
      if (pendingMemoSizeUpdatesRef.current[memoId]) {
        delete pendingMemoSizeUpdatesRef.current[memoId];
      }

      // 낙관적 삭제: 즉시 UI에서 제거
      const prevMemos = memos;
      setMemos(prev => prev.filter(m => m.id !== memoId));
      if (selectedMemoId === memoId) {
        setSelectedMemoId(null);
      }

      // 임시 메모라면 서버 삭제를 지연 플래그로 표시만
      if (isTempId(memoId)) {
        tempDeletedIdsRef.current.add(memoId);
        return;
      }

      const res = await fetch(`/api/canvases/${canvas.id}/memos/${memoId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      // 404는 이미 삭제된 상태로 간주하고 유지, 그 외 실패 시 복구
      if (!res.ok && res.status !== 404) {
        setMemos(prevMemos);
      }
    } catch (error) {
      console.error("Error deleting memo:", error);
      // 실패 시 복구
      setMemos(prev => prev);
    }
  }, [canvas.id, selectedMemoId, memos, isTempId]);

  // 메모 위치 업데이트 디바운싱을 위한 ref 저장소
  const memoUpdateTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingMemoUpdatesRef = useRef<Record<string, { position: { x: number; y: number }; originalMemo: any }>>({});

  const updateMemoPosition = useCallback(async (memoId: string, position: { x: number; y: number }) => {
    try {
      const memo = memos.find(m => m.id === memoId);
      if (!memo) return;

      // 로컬 상태 즉시 업데이트 (드래그 중 UI 반응성 보장)
      setMemos(prev => prev.map(m => m.id === memoId ? { ...m, position } : m));

      // 임시 메모면 서버 호출 대신 변경만 큐잉 후 종료
      if (isTempId(memoId)) {
        // 기존 타이머/보류 레코드 정리
        if (memoUpdateTimeoutsRef.current[memoId]) {
          clearTimeout(memoUpdateTimeoutsRef.current[memoId]);
          delete memoUpdateTimeoutsRef.current[memoId];
        }
        if (pendingMemoUpdatesRef.current[memoId]) {
          delete pendingMemoUpdatesRef.current[memoId];
        }
        tempMemoPendingRef.current[memoId] = {
          ...(tempMemoPendingRef.current[memoId] || {}),
          position
        };
        return;
      }

      // 기존 타이머 취소
      if (memoUpdateTimeoutsRef.current[memoId]) {
        clearTimeout(memoUpdateTimeoutsRef.current[memoId]);
      }

      // 원본 메모 정보와 새 위치 저장 (첫 번째 업데이트 시에만)
      if (!pendingMemoUpdatesRef.current[memoId]) {
        pendingMemoUpdatesRef.current[memoId] = {
          position,
          originalMemo: memo
        };
      } else {
        // 위치만 업데이트
        pendingMemoUpdatesRef.current[memoId].position = position;
      }

      // 500ms 디바운싱으로 서버 업데이트 지연
      memoUpdateTimeoutsRef.current[memoId] = setTimeout(async () => {
        const pendingUpdate = pendingMemoUpdatesRef.current[memoId];
        if (!pendingUpdate) return;

        try {
          const response = await fetch(`/api/canvases/${canvas.id}/memos/${memoId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              content: pendingUpdate.originalMemo.content,
              position: pendingUpdate.position
            })
          });
          
          if (!response.ok) {
            // 서버 업데이트 실패 시 원본 위치로 복원
            setMemos(prev => prev.map(m => 
              m.id === memoId ? { ...m, position: pendingUpdate.originalMemo.position } : m
            ));
          }
        } catch (error) {
          console.error("Error updating memo position:", error);
          // 에러 발생 시 원본 위치로 복원
          setMemos(prev => prev.map(m => 
            m.id === memoId ? { ...m, position: pendingUpdate.originalMemo.position } : m
          ));
        } finally {
          // 정리 작업
          delete memoUpdateTimeoutsRef.current[memoId];
          delete pendingMemoUpdatesRef.current[memoId];
        }
      }, 500); // 500ms 디바운싱

    } catch (error) {
      console.error("Error in updateMemoPosition:", error);
    }
  }, [canvas.id, memos, isTempId]);

  // 메모 크기 업데이트 디바운싱을 위한 ref 저장소
  const memoSizeUpdateTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const pendingMemoSizeUpdatesRef = useRef<Record<string, { size: { width: number; height: number }; originalMemo: any }>>({});

  // Handle memo size change
  const handleMemoSizeChange = useCallback(async (memoId: string, newSize: { width: number; height: number }) => {
    try {
      const memo = memos.find(m => m.id === memoId);
      if (!memo) return;

      // 로컬 상태 즉시 업데이트 (리사이즈 중 UI 반응성 보장)
      setMemos(prev => prev.map(m => 
        m.id === memoId ? { ...m, size: newSize } : m
      ));

      // 임시 메모면 서버 호출 대신 큐잉 후 종료
      if (isTempId(memoId)) {
        if (memoSizeUpdateTimeoutsRef.current[memoId]) {
          clearTimeout(memoSizeUpdateTimeoutsRef.current[memoId]);
          delete memoSizeUpdateTimeoutsRef.current[memoId];
        }
        if (pendingMemoSizeUpdatesRef.current[memoId]) {
          delete pendingMemoSizeUpdatesRef.current[memoId];
        }
        tempMemoPendingRef.current[memoId] = {
          ...(tempMemoPendingRef.current[memoId] || {}),
          size: newSize
        };
        return;
      }

      // 기존 타이머 취소
      if (memoSizeUpdateTimeoutsRef.current[memoId]) {
        clearTimeout(memoSizeUpdateTimeoutsRef.current[memoId]);
      }

      // 원본 메모 정보와 새 크기 저장 (첫 번째 업데이트 시에만)
      if (!pendingMemoSizeUpdatesRef.current[memoId]) {
        pendingMemoSizeUpdatesRef.current[memoId] = {
          size: newSize,
          originalMemo: memo
        };
      } else {
        // 크기만 업데이트
        pendingMemoSizeUpdatesRef.current[memoId].size = newSize;
      }

      // 300ms 디바운싱으로 서버 업데이트 지연 (크기 조절은 위치보다 빠르게)
      memoSizeUpdateTimeoutsRef.current[memoId] = setTimeout(async () => {
        const pendingUpdate = pendingMemoSizeUpdatesRef.current[memoId];
        if (!pendingUpdate) return;

        try {
          const response = await fetch(`/api/canvases/${canvas.id}/memos/${memoId}`, {
            method: 'PATCH',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ size: pendingUpdate.size })
          });
          
          if (!response.ok) {
            // 서버 업데이트 실패 시 원본 크기로 복원
            setMemos(prev => prev.map(m => 
              m.id === memoId ? { ...m, size: pendingUpdate.originalMemo.size } : m
            ));
          }
        } catch (error) {
          console.error("Error updating memo size:", error);
          // 에러 발생 시 원본 크기로 복원
          setMemos(prev => prev.map(m => 
            m.id === memoId ? { ...m, size: pendingUpdate.originalMemo.size } : m
          ));
        } finally {
          // 정리 작업
          delete memoSizeUpdateTimeoutsRef.current[memoId];
          delete pendingMemoSizeUpdatesRef.current[memoId];
        }
      }, 300); // 300ms 디바운싱

    } catch (error) {
      console.error("Error in handleMemoSizeChange:", error);
    }
  }, [canvas.id, memos, isTempId]);

  // 컴포넌트 언마운트 시 모든 타이머 정리
  useEffect(() => {
    return () => {
      // 메모 위치 업데이트 타이머 정리
      Object.values(memoUpdateTimeoutsRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      memoUpdateTimeoutsRef.current = {};
      pendingMemoUpdatesRef.current = {};

      // 메모 크기 업데이트 타이머 정리
      Object.values(memoSizeUpdateTimeoutsRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      memoSizeUpdateTimeoutsRef.current = {};
      pendingMemoSizeUpdatesRef.current = {};
    };
  }, []);

  // Create memo from modal
  const createMemoFromModal = useCallback(async (position: { x: number; y: number }, content: string) => {
    try {
      // 낙관적 추가: 임시 메모 즉시 표시
      const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const tempMemo: Memo = {
        id: tempId,
        content,
        position,
        size: { width: 200, height: 150 }
      };
      setMemos(prev => [...prev, tempMemo]);
      setSelectedMemoId(tempId);

      const response = await fetch(`/api/canvases/${canvas.id}/memos`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          position,
          size: { width: 200, height: 150 }
        }),
      });

      if (response.ok) {
        const newMemo = await response.json();
        // 임시 메모를 실제 메모로 교체
        setMemos(prev => prev.map(m => m.id === tempId ? newMemo : m));
        setSelectedMemoId(newMemo.id);
      } else {
        // 실패 시 임시 메모 제거
        setMemos(prev => prev.filter(m => m.id !== tempId));
        try {
          const text = await response.text();
          let message = `메모 생성에 실패했습니다. (HTTP ${response.status})`;
          if (text) {
            try {
              const obj = JSON.parse(text);
              message = obj?.error || obj?.message || message;
            } catch {
              // queryClient 에러 형태와 유사한 접두 제거 케이스 커버
              const start = text.indexOf('{');
              const end = text.lastIndexOf('}');
              if (start !== -1 && end !== -1 && end > start) {
                try {
                  const obj = JSON.parse(text.slice(start, end + 1));
                  message = obj?.error || obj?.message || text;
                } catch {
                  message = text;
                }
              } else {
                message = text;
              }
            }
          }
          toast({ title: '메모 생성 실패', description: message, variant: 'destructive' });
        } catch {
          toast({ title: '메모 생성 실패', description: '일시적인 오류가 발생했습니다. 다시 시도해주세요.', variant: 'destructive' });
        }
      }
    } catch (error) {
      console.error("Error creating memo:", error);
      // 에러 시 임시 메모 제거
      setMemos(prev => prev.filter(m => !m.id.startsWith('temp-')));
    }
  }, [canvas.id]);

  // Load memos when canvas changes
  useEffect(() => {
    // In read-only mode, use external memos if provided
    if (isReadOnly && externalMemos) {
      setMemos(externalMemos);
      return;
    }

    // In normal mode, fetch memos from API
    const fetchMemos = async () => {
      try {
        const response = await fetch(`/api/canvases/${canvas.id}/memos`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const memosData = await response.json();
          setMemos(memosData || []);
        } else {
          console.error("Failed to fetch memos:", response.status);
          setMemos([]);
        }
      } catch (error) {
        console.error("Error fetching memos:", error);
        setMemos([]);
      }
    };

    if (!isReadOnly) {
      fetchMemos();
    }
  }, [canvas.id, isReadOnly, externalMemos]);

  // Handle double click for node creation and memo creation
  const handleCanvasDoubleClick = useCallback((e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-node]')) return; // 노드 위 더블클릭은 무시
    if (el.closest('[data-memo-id]')) return; // 메모 위 더블클릭은 무시
    
    e.preventDefault();
    e.stopPropagation();
    
    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    
    // Alt + 더블클릭으로 메모 생성
    if (e.altKey) {
      createNewMemo(x, y);
    } else {
      // 일반 더블클릭으로 노드 생성
      setNodeCreationPosition({ x, y });
      setShowNodeCreationModal(true);
    }
  }, [getCanvasCoordinates, createNewMemo]);

  // Handle node creation from modal  
  const handleNodeCreation = useCallback(async (nodeData: { title: string; description?: string; icon: string; color: string }) => {
    const ok = await ensureNotOverFreeLimit(1);
    if (!ok) return;
    const newNode: FlowNode = {
      id: `${nodeData.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
      type: "custom", // All nodes are now custom type
      data: {
        title: nodeData.title,
        subtitle: nodeData.description || "", // Ensure subtitle is always a string
        icon: nodeData.icon,
        color: nodeData.color
      },
      position: { 
        x: nodeCreationPosition.x - 90, // Center the larger node
        y: nodeCreationPosition.y - 50 
      }
    };
    
    console.log("Creating node with data:", { 
      title: nodeData.title, 
      description: nodeData.description, 
      subtitle: nodeData.description,
      fullNodeData: newNode 
    });
    
    // 전역 상태 업데이트 후 저장 트리거
    const currentNodes = (useCanvasStore.getState().nodes || []) as FlowNode[];
    setLocalNodes([...currentNodes, newNode]);
    triggerSave("create-node", true);
    
    console.log(`Created new ${nodeData.title} node at (${nodeCreationPosition.x}, ${nodeCreationPosition.y})`);
  }, [nodeCreationPosition, setLocalNodes, triggerSave]);

  // Handle node double click for details
  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (node && onNodeDoubleClick) {
      onNodeDoubleClick(node);
    }
  }, [nodes, onNodeDoubleClick]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    // 연결 중에는 마우스 좌표를 캔버스 좌표로 변환하여 임시 연결선을 업데이트
    if (isConnecting) {
      const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
      setTemporaryConnection({ x, y });
      return;
    }
    // 패닝 또는 노드 드래그 중에는 별도 처리 없음
    if (isPanning || draggedNodeId) {
      return;
    }
  }, [isConnecting, isPanning, draggedNodeId, getCanvasCoordinates, setTemporaryConnection]);

  // 캔버스 영역에서 마우스 업 시, 연결 중이라면 연결 상태 초기화 (빈 공간에 놓을 때 임시 엣지 제거)
  const handleCanvasMouseUp = useCallback(() => {
    if (isConnecting) {
      setIsConnecting(false);
      setConnectionStart(null);
      setTemporaryConnection(null);
      setConnectionStartAnchor(null as any);
      setDraggedNodeId(null);
    }
  }, [isConnecting, setIsConnecting, setConnectionStart, setTemporaryConnection, setConnectionStartAnchor, setDraggedNodeId]);

  // 마우스 업 전역 정리는 훅에서 처리

  // remove legacy handleWheel (replaced by hook)

  // Global mouse event listeners moved to useCanvasInteractions for single-source-of-truth

  // 엣지 지오메트리는 CanvasEdges로 이전됨

  // Handle edge deletion
  const handleEdgeDelete = useCallback((edgeId: string, e: React.MouseEvent) => {
    console.log('🗑️ Attempting to delete edge:', edgeId);
    e.preventDefault();
    e.stopPropagation();
    
    // Find the edge to delete
    const edgeToDelete = edges.find(edge => edge.id === edgeId);
    if (!edgeToDelete) {
      console.error('Edge not found:', edgeId);
      return;
    }
    
    console.log('Found edge to delete:', edgeToDelete);
    
    // Update edges state immediately
    const updatedEdges = edges.filter(edge => edge.id !== edgeId);
    setEdges(updatedEdges);
    
    console.log('Updated edges:', { 
      before: edges.length, 
      after: updatedEdges.length,
      deletedEdge: edgeToDelete 
    });
    
    // 삭제 저장 즉시 트리거
    triggerSave("delete-edge", true);
  }, [edges, setEdges, triggerSave]);


  // 타이틀 편집 로직은 CanvasHeader로 이전됨

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-w-0 min-h-0">
      <CanvasHeader
        canvas={canvas}
        canvasState={canvasState}
        isReadOnly={isReadOnly}
        viewport={viewport}
        setViewport={setViewport}
        onOpenCreateNode={() => {
          const canvasRect = canvasRef.current?.getBoundingClientRect();
          if (canvasRect) {
            const centerX = (canvasRect.width / 2 - viewport.x) / viewport.zoom;
            const centerY = (canvasRect.height / 2 - viewport.y) / viewport.zoom;
            setNodeCreationPosition({ x: centerX, y: centerY });
          } else {
            setNodeCreationPosition({ x: 400, y: 300 });
          }
          setShowNodeCreationModal(true);
        }}
        onManualSave={() => { manualSavePendingRef.current = true; triggerSave("manual", true); }}
        onUpdateTitle={updateCanvasTitle}
        onResetOrCenterViewport={() => {
          if (finalNodes.length > 0) {
            const minX = Math.min(...finalNodes.map((node: FlowNode) => node.position.x));
            const maxX = Math.max(...finalNodes.map((node: FlowNode) => node.position.x));
            const minY = Math.min(...finalNodes.map((node: FlowNode) => node.position.y));
            const maxY = Math.max(...finalNodes.map((node: FlowNode) => node.position.y));
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const canvasWidth = window.innerWidth;
            const canvasHeight = window.innerHeight;
            setViewport({ x: canvasWidth / 2 - centerX, y: canvasHeight / 2 - centerY, zoom: 1 });
          } else {
            setViewport({ x: 0, y: 0, zoom: 1 });
          }
        }}
        lastSavedAt={lastSavedAt}
        isSaving={saving}
        profile={profile}
      />

      {/* Canvas Content */}
      <div 
        ref={canvasRef}
        className="flex-1 relative overflow-hidden canvas-content min-w-0 min-h-0"
        style={{ 
          cursor: draggedNodeId ? 'move' : 'grab',
          width: '100%',
          height: '100%',
          pointerEvents: showNodeCreationModal ? 'none' : 'auto'
        }}
        onMouseDown={!isReadOnly ? handleCanvasMouseDown : undefined}
        onPointerDown={!isReadOnly ? handleCanvasPointerDown : undefined}
        onMouseMove={!isReadOnly ? handleCanvasMouseMove : undefined}
        onMouseUp={!isReadOnly ? handleCanvasMouseUp : undefined}
        onDoubleClick={!isReadOnly ? handleCanvasDoubleClick : undefined}
        onWheel={handleWheel}
        onDragOver={!isReadOnly ? handleDragOver : undefined}
        onDrop={!isReadOnly ? handleDrop : undefined}
      >
        {/* Grid Background */}
        <div
          className="absolute inset-0 opacity-50 canvas-background"
          style={{
            backgroundImage: 'radial-gradient(circle, #e5e7eb 1px, transparent 1px)',
            backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
            backgroundPosition: `${viewport.x}px ${viewport.y}px`,
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        ></div>
        
        <CanvasEdges
          nodes={(isReadOnly ? (renderNodes as FlowNode[]) : nodes)}
          edges={(isReadOnly ? (flowData?.edges || []) : edges) as FlowEdge[]}
          viewport={viewport}
          isReadOnly={isReadOnly}
          isConnecting={isConnecting}
          connectionStart={connectionStart}
          connectionStartAnchor={connectionStartAnchor as any}
          temporaryConnection={temporaryConnection}
          livePositionsRef={livePositionsRef as any}
          onDeleteEdge={(edgeId) => handleEdgeDelete(edgeId, { preventDefault() {}, stopPropagation() {} } as any)}
        />

        {/* Canvas Nodes */}
        <div
          className="absolute inset-0"
          style={{ 
            zIndex: 2,
            transform: isReadOnly ? 'translate(0px, 0px) scale(1)' : `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            pointerEvents: 'none'
          }}
        >
          {(() => {
            
            return renderNodes.map((node: FlowNode, index: number) => {
              
              return (
                <div key={node.id} style={{ pointerEvents: 'auto' }}>
                  <FunnelNode
                    node={node}
                    selected={selectedNodeId === node.id}
                    onDoubleClick={!isReadOnly ? () => handleNodeDoubleClick(node.id) : undefined}
                    onMouseDown={!isReadOnly ? (e) => handleNodeMouseDown(node.id, e) : undefined}
                    onPointerDown={!isReadOnly ? (e) => handleNodePointerDown(node.id, e) : undefined}
                    onMouseUp={!isReadOnly ? () => handleNodeMouseUp(node.id) : undefined}
                    isDragging={draggedNodeId === node.id}
                    isConnectable={isConnecting && connectionStart !== node.id && !isReadOnly}
                    onConnectionStart={!isReadOnly ? handleConnectionStart : undefined}
                    onDelete={!isReadOnly ? handleNodeDelete : undefined}
                    isReadOnly={isReadOnly}
                    size={(node.data as any)?.size || "medium"}
                  />
                </div>
              );
            });
          })()}

          {/* Text Memos */}
          {memos.map((memo) => (
            <div key={memo.id} style={{ pointerEvents: 'auto' }}>
              <TextMemo
                id={memo.id}
                position={memo.position}
                content={memo.content}
                size={memo.size || { width: 280, height: 180 }}
                isSelected={!isReadOnly && selectedMemoId === memo.id}
                onUpdate={!isReadOnly ? updateMemo : () => {}}
                onDelete={!isReadOnly ? deleteMemo : () => {}}
                onSelect={(id) => {
                  if (!isReadOnly) {
                    setSelectedMemoId(id);
                    onNodeSelect(''); // Clear node selection
                  }
                }}
                onPositionChange={!isReadOnly ? updateMemoPosition : () => {}}
                onSizeChange={!isReadOnly ? handleMemoSizeChange : () => {}}
                viewport={viewport}
                isReadOnly={isReadOnly}
              />
            </div>
          ))}
        </div>

        {/* Usage Instructions */}






        {/* Node Palette - Hidden by default */}
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-xl shadow-xl border border-gray-200 p-4 hidden">
          <div className="flex items-center space-x-4">
            <div className="text-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center mb-2 mx-auto">
                <Mail className="h-4 w-4 text-blue-600" />
              </div>
              <span className="text-xs text-gray-600">이메일</span>
            </div>
            <div className="text-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center mb-2 mx-auto">
                <Monitor className="h-4 w-4 text-green-600" />
              </div>
              <span className="text-xs text-gray-600">랜딩</span>
            </div>
            <div className="text-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center mb-2 mx-auto">
                <Share className="h-4 w-4 text-purple-600" />
              </div>
              <span className="text-xs text-gray-600">소셜</span>
            </div>
            <div className="text-center cursor-pointer hover:bg-gray-50 p-2 rounded-lg">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center mb-2 mx-auto">
                <MessageSquare className="h-4 w-4 text-orange-600" />
              </div>
              <span className="text-xs text-gray-600">SMS</span>
            </div>
          </div>
        </div>



        {/* Node Creation Modal - Only show in edit mode */}
        {!isReadOnly && (
          <NodeCreationModal
            isOpen={showNodeCreationModal}
            onClose={() => setShowNodeCreationModal(false)}
            onCreateNode={(nodeType) => handleNodeCreation(nodeType)}
            onCreateMemo={(position, content) => createMemoFromModal(position, content)}
            position={nodeCreationPosition}
          />
        )}
      </div>
    </div>
  );
}
