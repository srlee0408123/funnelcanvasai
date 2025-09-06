import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CanvasHeader } from "@/components/Canvas/CanvasHeader";
import { CanvasEdges } from "@/components/Canvas/CanvasEdges";
import FunnelNode from "@/components/Canvas/FunnelNode";
import NodeCreationModal from "@/components/Canvas/NodeCreationModal";
import { TextMemo } from "@/components/Canvas/TextMemo";
import { useToast } from "@/hooks/use-toast";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useCanvasInteractions } from "@/hooks/use-canvas-interactions";
import { useCanvasSync } from "@/hooks/useCanvasSync";
import { createToastMessage } from "@/lib/messages/toast-utils";
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
  canShare?: boolean;
  onOpenShareModal?: () => void;
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
  canShare,
  onOpenShareModal
}: CanvasAreaProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
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
    onSuccess: () => {
      // 최신 상태 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["/api/canvases", canvas.id, "state", "latest"] });
      if (manualSavePendingRef.current) {
        const successMessage = createToastMessage.canvasSuccess('SAVE');
        toast(successMessage);
        manualSavePendingRef.current = false;
      }
    },
    onError: (error) => {
      if (manualSavePendingRef.current) {
        const errorMessage = createToastMessage.canvasError(error, 'SAVE');
        toast(errorMessage);
        manualSavePendingRef.current = false;
      }
    }
  });

  // 노드 추가 함수
  const handleAddNodeToCanvas = useCallback((nodeType: string) => {
    if (isReadOnly) return;

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
  }, [isReadOnly, addNode, triggerSave, toast]);

  // onAddNode prop이 있으면 실제 노드 추가 함수로 연결
  useEffect(() => {
    if (onAddNode) {
      // onAddNode를 실제 구현으로 대체
      (window as any).handleAddNodeToCanvas = handleAddNodeToCanvas;
    }
  }, [onAddNode, handleAddNodeToCanvas]);



  // 캔버스 인터랙션 훅 사용 (패닝/줌/드래그 성능 최적화)
  const { handleCanvasMouseDown, handleNodeMouseDown, handleWheel } = useCanvasInteractions({
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
    console.log('🎯 Node mouse up:', nodeId, 'IsConnecting:', isConnecting, 'ConnectionStart:', connectionStart);
    
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

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      
      if (data.type === 'node') {
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
  }, [viewport.x, viewport.y, viewport.zoom, setLocalNodes, triggerSave]);

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
    try {
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
        setMemos(prev => [...prev, newMemo]);
        setSelectedMemoId(newMemo.id);
      }
    } catch (error) {
      console.error("Error creating memo:", error);
    }
  }, [canvas.id]);

  const updateMemo = useCallback(async (memoId: string, content: string) => {
    try {
      const memo = memos.find(m => m.id === memoId);
      if (!memo) return;

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
  }, [canvas.id, memos]);

  const deleteMemo = useCallback(async (memoId: string) => {
    try {
      await fetch(`/api/canvases/${canvas.id}/memos/${memoId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      setMemos(prev => prev.filter(m => m.id !== memoId));
      if (selectedMemoId === memoId) {
        setSelectedMemoId(null);
      }
    } catch (error) {
      console.error("Error deleting memo:", error);
    }
  }, [canvas.id, selectedMemoId]);

  const updateMemoPosition = useCallback(async (memoId: string, position: { x: number; y: number }) => {
    try {
      const memo = memos.find(m => m.id === memoId);
      if (!memo) return;

      // Update local state immediately
      setMemos(prev => prev.map(m => m.id === memoId ? { ...m, position } : m));

      // Update server
      const response = await fetch(`/api/canvases/${canvas.id}/memos/${memoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content: memo.content,
          position
        })
      });
      
      if (!response.ok) {
        // Revert local state if server update failed
        setMemos(prev => prev.map(m => m.id === memoId ? memo : m));
      }
    } catch (error) {
      console.error("Error updating memo position:", error);
      // Revert local state
      const memo = memos.find(m => m.id === memoId);
      if (memo) {
        setMemos(prev => prev.map(m => m.id === memoId ? memo : m));
      }
    }
  }, [canvas.id, memos]);

  // Handle memo size change
  const handleMemoSizeChange = useCallback(async (memoId: string, newSize: { width: number; height: number }) => {
    // Optimistic update
    setMemos(prev => prev.map(m => 
      m.id === memoId ? { ...m, size: newSize } : m
    ));

    try {
      const response = await fetch(`/api/canvases/${canvas.id}/memos/${memoId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ size: newSize })
      });
      
      if (!response.ok) {
        // Revert local state if server update failed
        const memo = memos.find(m => m.id === memoId);
        if (memo) {
          setMemos(prev => prev.map(m => m.id === memoId ? memo : m));
        }
      }
    } catch (error) {
      console.error("Error updating memo size:", error);
      // Revert local state
      const memo = memos.find(m => m.id === memoId);
      if (memo) {
        setMemos(prev => prev.map(m => m.id === memoId ? memo : m));
      }
    }
  }, [canvas.id, memos]);

  // Create memo from modal
  const createMemoFromModal = useCallback(async (position: { x: number; y: number }, content: string) => {
    try {
      const response = await fetch(`/api/canvases/${canvas.id}/memos`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content,
          position,
          size: { width: 200, height: 150 } // Default size
        }),
      });

      if (response.ok) {
        const newMemo = await response.json();
        setMemos(prev => [...prev, newMemo]);
      } else {
        console.error("Failed to create memo:", response.status);
      }
    } catch (error) {
      console.error("Error creating memo:", error);
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
    // Prevent default canvas mouse move handling when global handlers are active
    if (isPanning || draggedNodeId || isConnecting) {
      return;
    }
  }, [isPanning, draggedNodeId, isConnecting]);

  // 마우스 업 전역 정리는 훅에서 처리

  // remove legacy handleWheel (replaced by hook)

  // Global mouse event listeners for dragging
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isPanning) {
        const deltaX = e.clientX - panStart.x;
        const deltaY = e.clientY - panStart.y;
        
        setViewport({
          x: lastPanPoint.x + deltaX,
          y: lastPanPoint.y + deltaY,
          zoom: viewport.zoom
        });
      } else if (draggedNodeId) {
        // Calculate movement delta in screen coordinates first
        const deltaX = e.clientX - nodeDragStart.x;
        const deltaY = e.clientY - nodeDragStart.y;
        
        // Apply delta scaled by zoom to original position
        const originalPos = nodePositions[draggedNodeId];
        if (originalPos) {
          const newX = originalPos.x + (deltaX / viewport.zoom);
          const newY = originalPos.y + (deltaY / viewport.zoom);
          
          setNodePositions(prev => ({
            ...prev,
            [draggedNodeId]: { x: newX, y: newY }
          }));
          

          

        }
      } else if (isConnecting && temporaryConnection) {
        // Update temporary connection mouse position in canvas coordinates
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          setTemporaryConnection({ 
            x: (e.clientX - rect.left - viewport.x) / viewport.zoom, 
            y: (e.clientY - rect.top - viewport.y) / viewport.zoom 
          });
        }
      }
    };

    const handleGlobalMouseUp = (e: MouseEvent) => {
      console.log('Global mouse up triggered. IsConnecting:', isConnecting, 'ConnectionStart:', connectionStart);
      
      // Enhanced connection detection
      if (isConnecting && connectionStart) {
        console.log('Mouse up during connection mode, checking for target...');
        const targetElement = document.elementFromPoint(e.clientX, e.clientY);
        const nodeElement = targetElement?.closest('[data-node-id]');
        console.log('Target element found:', nodeElement);
        
        if (nodeElement) {
          const targetNodeId = nodeElement.getAttribute('data-node-id');
          console.log(`Target node ID: ${targetNodeId}, Source: ${connectionStart}`);
          if (targetNodeId && targetNodeId !== connectionStart) {
            // Check if connection already exists
            const connectionExists = edges.some(edge => 
              edge.source === connectionStart && edge.target === targetNodeId
            );
            console.log(`Connection exists check: ${connectionExists}`);
            
            if (!connectionExists) {
              // Create new connection with enhanced feedback
              const newEdge: FlowEdge = {
                id: `edge-${connectionStart}-${targetNodeId}-${Date.now()}`,
                source: connectionStart,
                target: targetNodeId,
                data: {
                  sourceAnchor: (connectionStartAnchor as any) || 'right',
                  targetAnchor: (() => {
                    const sourceNode = nodes.find(n => n.id === connectionStart);
                    const targetNode = nodes.find(n => n.id === targetNodeId);
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
              
              console.log(`Creating new edge:`, newEdge);
              
              // Update local state immediately
              const newEdges = [...edges, newEdge];
              setEdges(newEdges);
              console.log('Current edges after adding connection:', newEdges);
              console.log(`Created connection from ${connectionStart} to ${targetNodeId}`);
              
              // 저장 트리거 (즉시 저장)
              triggerSave("connect", true);
              
              // Optional: Add success visual feedback here
            } else {
              console.log(`Connection already exists from ${connectionStart} to ${targetNodeId}`);
            }
          } else {
            console.log('No valid target node ID or same as source');
          }
        } else {
          console.log('No node element found at drop location');
        }
      } else {
        console.log('Not in connection mode or no connection start');
      }
      

      
      // Save node position changes to server when dragging ends
      if (draggedNodeId) {
        const newPosition = nodePositions[draggedNodeId];
        if (newPosition) {
          // 즉시 저장으로 포지션 반영
          triggerSave("drag-end", true);
        }
      }

      // Clear connection states
      setIsConnecting(false);
      setConnectionStart(null);
      setTemporaryConnection(null);
      setConnectionStartAnchor(null as any);
      
      setIsPanning(false);
      setDraggedNodeId(null);
    };

    if (isPanning || draggedNodeId || isConnecting) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleGlobalMouseMove);
        document.removeEventListener('mouseup', handleGlobalMouseUp);
      };
    }
  }, [isPanning, panStart.x, panStart.y, lastPanPoint.x, lastPanPoint.y, draggedNodeId, viewport.x, viewport.y, viewport.zoom, isConnecting, connectionStart, temporaryConnection, edges, nodeDragStart.x, nodeDragStart.y, nodePositions, setConnectionStart, setDraggedNodeId, setEdges, setIsConnecting, setIsPanning, setNodePositions, setTemporaryConnection, setViewport, triggerSave]);

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
        canShare={canShare}
        onOpenShareModal={onOpenShareModal}
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
      />

      {/* Canvas Content */}
      <div 
        ref={canvasRef}
        className="flex-1 relative overflow-hidden canvas-content min-w-0 min-h-0"
        style={{ 
          cursor: draggedNodeId ? 'move' : 'grab',
          width: '100%',
          height: '100%'
        }}
        onMouseDown={!isReadOnly ? handleCanvasMouseDown : undefined}
        onMouseMove={!isReadOnly ? handleCanvasMouseMove : undefined}
        onMouseUp={undefined}
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
            console.log('🎯 Rendering nodes container:', {
              renderNodesLength: renderNodes.length,
              isReadOnly,
              viewport,
              transform: isReadOnly ? 'translate(0px, 0px) scale(1)' : `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
            });
            
            return renderNodes.map((node: FlowNode, index: number) => {
              console.log(`🎯 Rendering node ${index}:`, {
                id: node.id,
                position: node.position,
                title: node.data?.title
              });
              
              return (
                <div key={node.id} style={{ pointerEvents: 'auto' }}>
                  <FunnelNode
                    node={node}
                    selected={selectedNodeId === node.id}
                    onDoubleClick={!isReadOnly ? () => handleNodeDoubleClick(node.id) : undefined}
                    onMouseDown={!isReadOnly ? (e) => handleNodeMouseDown(node.id, e) : undefined}
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
