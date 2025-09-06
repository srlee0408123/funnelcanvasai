/**
 * useCanvasStore - 캔버스 상태 전역 관리 (Zustand)
 * 
 * 주요 역할:
 * 1. 노드/엣지/뷰포트/드래그/연결 등 캔버스 상호작용 상태를 전역으로 관리
 * 2. 컴포넌트로부터 상태 로직을 분리하여 가독성과 테스트 용이성 향상
 * 3. 필요한 조각만 구독해 불필요한 리렌더링 최소화
 * 
 * 핵심 특징:
 * - FlowNode/FlowEdge 타입을 기반으로 타입 안전 보장
 * - 드래그/패닝/연결에 필요한 에페메랄 상태 제공
 * - 액션(함수)로 상태 변경, 단위 테스트에 용이
 * 
 * 주의사항:
 * - 서버 동기화는 별도 훅에서 처리(디바운스 저장)
 * - 레이아웃/렌더 최적화는 구독 단위(selector)로 조절
 * - 메모(TextMemo)는 별도 로직 유지(추후 이관 가능)
 */
import { create } from 'zustand';
import type { FlowNode, FlowEdge } from '@/types/canvas';

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

type Point = { x: number; y: number };
type NodePositions = Record<string, Point>;
type ConnectionAnchor = 'left' | 'right' | 'top' | 'bottom';

interface CanvasStoreState {
  // Core
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport: Viewport;

  // Panning
  isPanning: boolean;
  panStart: Point;
  lastPanPoint: Point;

  // Dragging
  draggedNodeId: string | null;
  nodeDragStart: Point;
  nodePositions: NodePositions;

  // Connecting
  isConnecting: boolean;
  connectionStart: string | null;
  temporaryConnection: Point | null;
  connectionStartAnchor: ConnectionAnchor | null;

  // Actions
  setNodes: (nodes: FlowNode[]) => void;
  addNode: (node: FlowNode) => void;
  updateNodePosition: (nodeId: string, position: Point) => void;
  deleteNode: (nodeId: string) => void;

  setEdges: (edges: FlowEdge[]) => void;
  addEdge: (edge: FlowEdge) => void;
  deleteEdge: (edgeId: string) => void;

  setViewport: (v: Viewport) => void;

  setIsPanning: (v: boolean) => void;
  setPanStart: (p: Point) => void;
  setLastPanPoint: (p: Point) => void;

  setDraggedNodeId: (id: string | null) => void;
  setNodeDragStart: (p: Point) => void;
  setNodePositions: (next: NodePositions | ((prev: NodePositions) => NodePositions)) => void;

  setIsConnecting: (v: boolean) => void;
  setConnectionStart: (id: string | null) => void;
  setTemporaryConnection: (p: Point | null) => void;
  setConnectionStartAnchor: (a: ConnectionAnchor | null) => void;

  resetEphemeral: () => void;
  resetAll: () => void;
}

export const useCanvasStore = create<CanvasStoreState>((set, get) => ({
  // Initial
  nodes: [],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },

  isPanning: false,
  panStart: { x: 0, y: 0 },
  lastPanPoint: { x: 0, y: 0 },

  draggedNodeId: null,
  nodeDragStart: { x: 0, y: 0 },
  nodePositions: {},

  isConnecting: false,
  connectionStart: null,
  temporaryConnection: null,
  connectionStartAnchor: null,

  // Node actions
  setNodes: (nodes) => set({ nodes }),
  addNode: (node) => set((state) => ({ nodes: [...state.nodes, node] })),
  updateNodePosition: (nodeId, position) =>
    set((state) => ({
      nodes: state.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)),
    })),
  deleteNode: (nodeId) =>
    set((state) => ({
      nodes: state.nodes.filter((n) => n.id !== nodeId),
      edges: state.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    })),

  // Edge actions
  setEdges: (edges) => set({ edges }),
  addEdge: (edge) =>
    set((state) => {
      const exists = state.edges.some((e) => e.source === edge.source && e.target === edge.target);
      return exists ? {} : { edges: [...state.edges, edge] };
    }),
  deleteEdge: (edgeId) => set((state) => ({ edges: state.edges.filter((e) => e.id !== edgeId) })),

  // Viewport
  setViewport: (v) => set({ viewport: v }),

  // Panning
  setIsPanning: (v) => set({ isPanning: v }),
  setPanStart: (p) => set({ panStart: p }),
  setLastPanPoint: (p) => set({ lastPanPoint: p }),

  // Dragging
  setDraggedNodeId: (id) => set({ draggedNodeId: id }),
  setNodeDragStart: (p) => set({ nodeDragStart: p }),
  setNodePositions: (next) =>
    set((state) => ({
      nodePositions: typeof next === 'function' ? (next as any)(state.nodePositions) : next,
    })),

  // Connecting
  setIsConnecting: (v) => set({ isConnecting: v }),
  setConnectionStart: (id) => set({ connectionStart: id }),
  setTemporaryConnection: (p) => set({ temporaryConnection: p }),
  setConnectionStartAnchor: (a) => set({ connectionStartAnchor: a }),

  // Reset helpers
  resetEphemeral: () =>
    set({
      isPanning: false,
      draggedNodeId: null,
      isConnecting: false,
      connectionStart: null,
      temporaryConnection: null,
      connectionStartAnchor: null,
    }),
  resetAll: () =>
    set({
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      isPanning: false,
      panStart: { x: 0, y: 0 },
      lastPanPoint: { x: 0, y: 0 },
      draggedNodeId: null,
      nodeDragStart: { x: 0, y: 0 },
      nodePositions: {},
      isConnecting: false,
      connectionStart: null,
      temporaryConnection: null,
      connectionStartAnchor: null,
    }),
}));


