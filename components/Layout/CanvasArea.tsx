import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { Button } from "@/components/Ui/buttons";
import FunnelNode from "@/components/Canvas/FunnelNode";
import NodeCreationModal from "@/components/Canvas/NodeCreationModal";
import { TextMemo } from "@/components/Canvas/TextMemo";
import { useToast } from "@/hooks/use-toast";
import { useCanvasStore } from "@/hooks/useCanvasStore";
import { useCanvasSync } from "@/hooks/useCanvasSync";
import { 
  ArrowLeft, 
  Check, 
  X, 
  Edit, 
  Clock, 
  Share, 
  Plus, 
  Minus, 
  Mail, 
  Monitor, 
  MessageSquare,
  Save,
  Loader2
} from "lucide-react";
import type { Canvas, CanvasState } from "@shared/schema";
import type { FlowNode, FlowEdge, TextMemoData } from "@/types/canvas";

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
  externalMemos
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
  
  // Node creation modal state
  const [showNodeCreationModal, setShowNodeCreationModal] = useState(false);
  const [nodeCreationPosition, setNodeCreationPosition] = useState({ x: 0, y: 0 });
  
  // Text memos state
  const [memos, setMemos] = useState<Memo[]>([]);
  const [selectedMemoId, setSelectedMemoId] = useState<string | null>(null);
  

  
  // Title editing state
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");



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

  // Zustand 기반 디바운스 저장 훅
  const { triggerSave } = useCanvasSync(canvas.id, {
    debounceMs: 1000,
    onSuccess: () => {
      // 최신 상태 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ["/api/canvases", canvas.id, "state", "latest"] });
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

    toast({
      title: "노드 추가됨",
      description: `${config.title} 노드가 캔버스에 추가되었습니다.`,
    });
  }, [isReadOnly, addNode, triggerSave, toast]);

  // onAddNode prop이 있으면 실제 노드 추가 함수로 연결
  useEffect(() => {
    if (onAddNode) {
      // onAddNode를 실제 구현으로 대체
      (window as any).handleAddNodeToCanvas = handleAddNodeToCanvas;
    }
  }, [onAddNode, handleAddNodeToCanvas]);



  // Node interaction handlers
  const handleNodeMouseDown = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Store initial mouse position for drag calculation
    setDraggedNodeId(nodeId);
    setNodeDragStart({
      x: e.clientX,
      y: e.clientY
    });
    
    // Store initial node position
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      setNodePositions(prev => ({
        ...prev,
        [nodeId]: node.position
      }));
    }
  }, [nodes, setDraggedNodeId, setNodeDragStart, setNodePositions]);

  // Connection start from connection point
  const handleConnectionStart = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsConnecting(true);
    setConnectionStart(nodeId);
    
    // Get the source node position for smooth temporary line
    const sourceNode = nodes.find(n => n.id === nodeId);
    if (sourceNode) {
      const rect = (e.target as HTMLElement).closest('.canvas-content')?.getBoundingClientRect();
      if (rect) {
        // Start from the right edge of the source node
        const startX = sourceNode.position.x + 160; // Right edge
        const startY = sourceNode.position.y + 40;  // Center vertically
        setTemporaryConnection({ 
          x: (e.clientX - rect.left - viewport.x) / viewport.zoom, 
          y: (e.clientY - rect.top - viewport.y) / viewport.zoom
        });
      }
    }
  }, [nodes, viewport.x, viewport.y, viewport.zoom, setIsConnecting, setConnectionStart, setTemporaryConnection]);

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
    setDraggedNodeId(null);
  }, [isConnecting, connectionStart, edges, setIsConnecting, setConnectionStart, setTemporaryConnection, setDraggedNodeId, setEdges, triggerSave]);

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

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    const el = e.target as HTMLElement;
    
    // 노드 위라면 캔버스 패닝 금지 (노드 자체에서 처리하도록)
    if (el.closest('[data-node]')) return;
    // 메모 위라면 캔버스 패닝 금지
    if (el.closest('[data-memo-id]')) return;
    
    // Clear any existing selections
    onNodeSelect('');
    setSelectedMemoId(null);
    
    // 배경/빈 공간이면 패닝 시작
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY });
    setLastPanPoint({ x: viewport.x, y: viewport.y });
    e.preventDefault();
  }, [viewport.x, viewport.y, onNodeSelect, setIsPanning, setPanStart, setLastPanPoint]);

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

  const handleCanvasMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggedNodeId(null);
    setIsConnecting(false);
    setConnectionStart(null);
    setTemporaryConnection(null);
  }, [setIsPanning, setDraggedNodeId, setIsConnecting, setConnectionStart, setTemporaryConnection]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(3, viewport.zoom * delta));
    
    // Calculate zoom center point
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const centerX = e.clientX - rect.left;
      const centerY = e.clientY - rect.top;
      
      // Adjust position to zoom towards mouse cursor
      const zoomRatio = newZoom / viewport.zoom;
      const newX = centerX - (centerX - viewport.x) * zoomRatio;
      const newY = centerY - (centerY - viewport.y) * zoomRatio;
      
      setViewport({
        x: newX,
        y: newY,
        zoom: newZoom
      });
    }
  }, [viewport, setViewport]);

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

  // Generate SVG path for edges with smooth bezier curves and proper connection points
  const generatePath = useCallback((edge: FlowEdge): string => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    
    if (!sourceNode || !targetNode) {
      return "";
    }

    // Standard node dimensions
    const nodeWidth = 160;
    const nodeHeight = 80;

    // Connection points at the edges of the nodes (not center)
    const sourceX = sourceNode.position.x + nodeWidth; // Right edge of source node
    const sourceY = sourceNode.position.y + nodeHeight / 2;  // Center vertically
    const targetX = targetNode.position.x;       // Left edge of target node  
    const targetY = targetNode.position.y + nodeHeight / 2;  // Center vertically

    // For multiple connections from same source, offset them vertically
    const connectionsFromSource = edges.filter(e => e.source === edge.source);
    const connectionIndex = connectionsFromSource.findIndex(e => e.id === edge.id);
    const offsetY = (connectionIndex - (connectionsFromSource.length - 1) / 2) * 15;

    // Calculate control points for smooth bezier curve
    const deltaX = targetX - sourceX;
    const controlOffset = Math.max(Math.abs(deltaX) * 0.4, 50);
    
    const control1X = sourceX + controlOffset;
    const control1Y = sourceY + offsetY;
    const control2X = targetX - controlOffset;
    const control2Y = targetY;
    
    // Create smooth cubic bezier curve
    return `M ${sourceX} ${sourceY + offsetY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${targetX} ${targetY}`;
  }, [nodes, edges]);

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

  // Get feedback severity for node
  const getNodeFeedbackSeverity = (nodeId: string): "none" | "low" | "medium" | "high" => {
    // This would come from AI feedback data
    // For demo purposes, return different severities for different nodes
    if (nodeId === "email-1") return "medium";
    if (nodeId === "landing-1") return "low";
    if (nodeId === "crm-1") return "high";
    return "none";
  };

  // Handle title editing
  const handleTitleEdit = () => {
    setEditedTitle(canvas.title);
    setIsEditingTitle(true);
  };

  const handleTitleSave = async () => {
    if (editedTitle.trim() && editedTitle !== canvas.title) {
      try {
        console.log('🏷️ Saving canvas title:', editedTitle.trim());
        
        const response = await fetch(`/api/canvases/${canvas.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ title: editedTitle.trim() })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const updatedCanvas = await response.json();
        console.log('✅ Canvas title updated successfully:', updatedCanvas);
        
        // Refresh canvas data
        queryClient.invalidateQueries({ queryKey: ["/api/canvases", canvas.id] });
        queryClient.invalidateQueries({ queryKey: ["/api/workspaces", canvas.workspaceId, "canvases"] });
        
        // Force immediate refetch
        await queryClient.refetchQueries({ queryKey: ["/api/canvases", canvas.id] });
        
      } catch (error) {
        console.error("❌ Failed to update canvas title:", error);
      }
    }
    setIsEditingTitle(false);
  };

  const handleTitleCancel = () => {
    setEditedTitle("");
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleTitleCancel();
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50 min-w-0 min-h-0">
      {/* Header */}
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
                />
                <div className="flex items-center space-x-1">
                  <button
                    onClick={handleTitleSave}
                    className="p-1 text-green-600 hover:bg-green-100 rounded"
                    title="저장"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleTitleCancel}
                    className="p-1 text-red-600 hover:bg-red-100 rounded"
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
                {!isReadOnly && <Edit className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />}
              </h2>
            )}
            <div className="flex items-center space-x-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              <span>마지막 저장: {canvasState ? new Date(canvasState.createdAt!).toLocaleString() : "저장된 상태 없음"}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {!isReadOnly && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  // 캔버스 중앙에 노드 생성 모달 열기
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
                onClick={() => {
                  // 즉시 저장
                  triggerSave("manual", true);
                  console.log('캔버스를 수동으로 저장했습니다.');
                }}
                title="수동 저장"
              >
                <Save className="h-4 w-4" />
              </Button>
            )}
            {!isReadOnly && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={async () => {
                  try {
                    const shareUrl = `${window.location.origin}/share/${canvas.id}`;
                    await navigator.clipboard.writeText(shareUrl);
                    toast({
                      title: "공유 링크 복사 완료!",
                      description: "캔버스 공유 링크가 클립보드에 복사되었습니다. 이제 다른 사람들과 공유할 수 있어요.",
                      duration: 3000,
                    });
                  } catch (error) {
                    console.error('클립보드 복사 실패:', error);
                    toast({
                      title: "클립보드 복사 실패",
                      description: "공유 링크를 클립보드에 복사할 수 없습니다. 수동으로 복사해주세요.",
                      variant: "destructive",
                      duration: 5000,
                    });
                  }
                }}
                title="읽기 전용 공유 링크 복사"
              >
                <Share className="h-4 w-4" />
              </Button>
            )}
            <div className="w-px h-6 bg-gray-200"></div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (finalNodes.length > 0) {
                  // Calculate bounding box of all nodes
                  const minX = Math.min(...finalNodes.map((node: FlowNode) => node.position.x));
                  const maxX = Math.max(...finalNodes.map((node: FlowNode) => node.position.x));
                  const minY = Math.min(...finalNodes.map((node: FlowNode) => node.position.y));
                  const maxY = Math.max(...finalNodes.map((node: FlowNode) => node.position.y));
                  
                  const centerX = (minX + maxX) / 2;
                  const centerY = (minY + maxY) / 2;
                  
                  // Center viewport on nodes
                  const canvasWidth = window.innerWidth;
                  const canvasHeight = window.innerHeight;
                  
                  setViewport({
                    x: canvasWidth / 2 - centerX,
                    y: canvasHeight / 2 - centerY,
                    zoom: 1
                  });
                } else {
                  setViewport({ x: 0, y: 0, zoom: 1 });
                }
              }}
            >
              {Math.round(viewport.zoom * 100)}%
            </Button>
            <div className="flex items-center space-x-1">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setViewport({ ...viewport, zoom: Math.min(3, viewport.zoom * 1.2) })}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setViewport({ ...viewport, zoom: Math.max(0.1, viewport.zoom * 0.8) })}
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Canvas Content */}
      <div 
        ref={canvasRef}
        className="flex-1 relative overflow-hidden canvas-content min-w-0 min-h-0"
        style={{ 
          cursor: isPanning ? 'grabbing' : (draggedNodeId ? 'move' : 'grab'),
          width: '100%',
          height: '100%'
        }}
        onMouseDown={!isReadOnly ? handleCanvasMouseDown : undefined}
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
        
        {/* SVG for Connection Lines */}
        <svg 
          className="absolute inset-0 w-full h-full" 
          style={{ 
            zIndex: 1,
            pointerEvents: 'none'
          }}
        >
          <defs>
            {/* 일반 화살표 - 그라데이션과 그림자 효과 */}
            <linearGradient id="arrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor:"#6366F1", stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:"#3B82F6", stopOpacity:1}} />
            </linearGradient>
            <filter id="arrowShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="1" dy="1" stdDeviation="1" floodOpacity="0.3"/>
            </filter>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path
                d="M 0 0 L 8 3 L 0 6 L 2 3 Z"
                fill="url(#arrowGradient)"
                filter="url(#arrowShadow)"
              />
            </marker>

            {/* 임시 연결 화살표 - 더 밝고 애니메이션 효과 */}
            <linearGradient id="tempArrowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor:"#06B6D4", stopOpacity:1}} />
              <stop offset="100%" style={{stopColor:"#3B82F6", stopOpacity:1}} />
            </linearGradient>
            <marker
              id="temp-arrowhead"
              markerWidth="10"
              markerHeight="7"
              refX="9"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path
                d="M 0 0 L 10 3.5 L 0 7 L 2.5 3.5 Z"
                fill="url(#tempArrowGradient)"
                filter="url(#arrowShadow)"
              />
            </marker>

            {/* 연결선 그라데이션 */}
            <linearGradient id="connectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor:"#8B5CF6", stopOpacity:0.8}} />
              <stop offset="50%" style={{stopColor:"#6366F1", stopOpacity:0.9}} />
              <stop offset="100%" style={{stopColor:"#3B82F6", stopOpacity:0.8}} />
            </linearGradient>

            {/* 임시 연결선 그라데이션 */}
            <linearGradient id="tempConnectionGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style={{stopColor:"#06B6D4", stopOpacity:0.7}} />
              <stop offset="100%" style={{stopColor:"#3B82F6", stopOpacity:0.9}} />
            </linearGradient>
          </defs>
          {(isReadOnly ? (flowData?.edges || []) : edges).map((edge: FlowEdge) => {
            const path = generatePath(edge);
            const sourceNode = (isReadOnly ? renderNodes : nodes).find((n: FlowNode) => n.id === edge.source);
            const targetNode = (isReadOnly ? renderNodes : nodes).find((n: FlowNode) => n.id === edge.target);
            
            if (!sourceNode || !targetNode || !path) {
              return null;
            }
            
            // Calculate precise midpoint using EXACT same logic as generatePath function
            const nodeWidth = 160;
            const nodeHeight = 80;
            const sourceX = sourceNode.position.x + nodeWidth;
            const sourceY = sourceNode.position.y + nodeHeight / 2;
            const targetX = targetNode.position.x;
            const targetY = targetNode.position.y + nodeHeight / 2;
            
            // IMPORTANT: Use exact same offsetY calculation as generatePath
            const currentEdges = isReadOnly ? (flowData?.edges || []) : edges;
            const connectionsFromSource = currentEdges.filter((e: FlowEdge) => e.source === edge.source);
            const connectionIndex = connectionsFromSource.findIndex((e: FlowEdge) => e.id === edge.id);
            const offsetY = (connectionIndex - (connectionsFromSource.length - 1) / 2) * 15;
            
            // IMPORTANT: Use exact same control point calculation as generatePath
            const deltaX = targetX - sourceX;
            const controlOffset = Math.max(Math.abs(deltaX) * 0.4, 50);
            const control1X = sourceX + controlOffset;
            const control1Y = sourceY + offsetY;
            const control2X = targetX - controlOffset;
            const control2Y = targetY;
            
            // Calculate the actual midpoint of the cubic bezier curve at t=0.5
            const t = 0.5;
            const midX = Math.pow(1-t, 3) * sourceX + 
                       3 * Math.pow(1-t, 2) * t * control1X + 
                       3 * (1-t) * Math.pow(t, 2) * control2X + 
                       Math.pow(t, 3) * targetX;
            const midY = Math.pow(1-t, 3) * (sourceY + offsetY) + 
                       3 * Math.pow(1-t, 2) * t * control1Y + 
                       3 * (1-t) * Math.pow(t, 2) * control2Y + 
                       Math.pow(t, 3) * targetY;
            
            return (
              <g key={edge.id} data-edge={edge.id}>
                <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
                  {/* 배경 그림자 라인 */}
                  <path
                    d={path}
                    stroke="rgba(0,0,0,0.1)"
                    strokeWidth={4 / viewport.zoom}
                    fill="none"
                    className="pointer-events-none"
                  />
                  {/* 메인 연결선 */}
                  <path
                    d={path}
                    stroke="url(#connectionGradient)"
                    strokeWidth={2 / viewport.zoom}
                    fill="none"
                    markerEnd="url(#arrowhead)"
                    className="hover:stroke-[url(#tempConnectionGradient)] transition-all duration-300 hover:drop-shadow-lg"
                    style={{ 
                      pointerEvents: 'stroke',
                      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))'
                    }}
                    onMouseEnter={() => {
                      // Show delete button when hovering over connection line
                      const deleteButton = document.querySelector(`[data-edge="${edge.id}"] .delete-button`);
                      if (deleteButton) {
                        (deleteButton as HTMLElement).style.opacity = '1';
                      }
                    }}
                    onMouseLeave={() => {
                      // Hide delete button when leaving connection line
                      setTimeout(() => {
                        const deleteButton = document.querySelector(`[data-edge="${edge.id}"] .delete-button`);
                        if (deleteButton && !deleteButton.matches(':hover')) {
                          (deleteButton as HTMLElement).style.opacity = '0';
                        }
                      }, 100);
                    }}
                  />
                </g>
                
                {/* 연결선 삭제 버튼을 뷰포트 변환 내부에 배치 */}
                <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
                  <g 
                    className="delete-button opacity-0 hover:opacity-100 transition-opacity duration-200"
                    style={{
                      pointerEvents: 'all',
                      cursor: 'pointer'
                    }}
                    transform={`translate(${midX}, ${midY})`}
                    onMouseEnter={() => {
                      // Force show on hover
                      const target = document.querySelector(`[data-edge="${edge.id}"] .delete-button`);
                      if (target) (target as HTMLElement).style.opacity = '1';
                    }}
                    onMouseLeave={() => {
                      // Hide delete button when leaving button area
                      const target = document.querySelector(`[data-edge="${edge.id}"] .delete-button`);
                      if (target) (target as HTMLElement).style.opacity = '0';
                    }}
                    onClick={(e) => {
                      console.log('🗑️ Delete button clicked for edge:', edge.id);
                      e.preventDefault();
                      e.stopPropagation();
                      handleEdgeDelete(edge.id, e);
                    }}
                    onMouseDown={(e) => {
                      console.log('🗑️ Delete button mouse down for edge:', edge.id);
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                  >
                    {/* 클릭 영역 - 약간 더 작게 */}
                    <circle
                      cx={0}
                      cy={0}
                      r={10 / viewport.zoom}
                      fill="transparent"
                      style={{ 
                        pointerEvents: 'all',
                        cursor: 'pointer'
                      }}
                    />
                    {/* 배경 원 - 더 작게 */}
                    <circle
                      cx={0}
                      cy={0}
                      r={8 / viewport.zoom}
                      fill="white"
                      stroke="#EF4444"
                      strokeWidth={1.5 / viewport.zoom}
                      style={{ 
                        pointerEvents: 'none',
                        filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3))'
                      }}
                    />
                    {/* X 아이콘 - 더 작고 정확한 크기 */}
                    <g style={{ pointerEvents: 'none' }}>
                      <line
                        x1={-3 / viewport.zoom}
                        y1={-3 / viewport.zoom}
                        x2={3 / viewport.zoom}
                        y2={3 / viewport.zoom}
                        stroke="#EF4444"
                        strokeWidth={1.5 / viewport.zoom}
                        strokeLinecap="round"
                      />
                      <line
                        x1={3 / viewport.zoom}
                        y1={-3 / viewport.zoom}
                        x2={-3 / viewport.zoom}
                        y2={3 / viewport.zoom}
                        stroke="#EF4444"
                        strokeWidth={1.5 / viewport.zoom}
                        strokeLinecap="round"
                      />
                    </g>
                  </g>
                </g>
              </g>
            );
          })}
          
          {/* Temporary connection line while connecting */}
          {!isReadOnly && isConnecting && connectionStart && temporaryConnection && (() => {
            const sourceNode = (isReadOnly ? renderNodes : nodes).find((n: FlowNode) => n.id === connectionStart);
            if (!sourceNode) return null;
            
            // Standard node dimensions
            const nodeWidth = 160;
            const nodeHeight = 80;
            
            const sourceX = sourceNode.position.x + nodeWidth; // Right edge of source node
            const sourceY = sourceNode.position.y + nodeHeight / 2;  // Center vertically
            const targetX = temporaryConnection.x;
            const targetY = temporaryConnection.y;
            
            // Create a smooth bezier curve for temporary connection
            const deltaX = targetX - sourceX;
            const controlOffset = Math.max(Math.abs(deltaX) * 0.4, 50);
            const control1X = sourceX + controlOffset;
            const control1Y = sourceY;
            const control2X = targetX - controlOffset;
            const control2Y = targetY;
            
            const tempPath = `M ${sourceX} ${sourceY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${targetX} ${targetY}`;
            
            return (
              <g transform={`translate(${viewport.x},${viewport.y}) scale(${viewport.zoom})`}>
                {/* 배경 글로우 효과 */}
                <path
                  d={tempPath}
                  stroke="rgba(59, 130, 246, 0.3)"
                  strokeWidth={6 / viewport.zoom}
                  fill="none"
                  className="pointer-events-none"
                />
                {/* 메인 임시 연결선 */}
                <path
                  d={tempPath}
                  stroke="url(#tempConnectionGradient)"
                  strokeWidth={2.5 / viewport.zoom}
                  fill="none"
                  strokeDasharray={`${6 / viewport.zoom},${3 / viewport.zoom}`}
                  markerEnd="url(#temp-arrowhead)"
                  className="animate-pulse"
                  style={{
                    filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.5))'
                  }}
                />
                {/* 향상된 타겟 포인트 */}
                <g className="animate-pulse">
                  <circle 
                    cx={targetX} 
                    cy={targetY} 
                    r={8 / viewport.zoom} 
                    fill="rgba(59, 130, 246, 0.2)" 
                    className="animate-ping"
                  />
                  <circle 
                    cx={targetX} 
                    cy={targetY} 
                    r={4 / viewport.zoom} 
                    fill="url(#tempArrowGradient)"
                    className="animate-bounce"
                  />
                </g>
              </g>
            );
          })()}
        </svg>

        {/* Canvas Nodes */}
        <div
          className="absolute inset-0"
          style={{ 
            zIndex: 2,
            transform: isReadOnly ? 'translate(0px, 0px) scale(1)' : `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
            transformOrigin: '0 0',
            width: '100%',
            height: '100%',
            pointerEvents: 'auto'
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
                <FunnelNode
                  key={node.id}
                  node={node}
                  selected={selectedNodeId === node.id}
                  feedbackSeverity={getNodeFeedbackSeverity(node.id)}
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
              );
            });
          })()}

          {/* Text Memos */}
          {memos.map((memo) => (
            <TextMemo
              key={memo.id}
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
