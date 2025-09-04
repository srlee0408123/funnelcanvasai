/**
 * Canvas 관련 타입 정의
 * 
 * 주요 역할:
 * 1. Canvas 컴포넌트에서 사용되는 모든 타입 정의
 * 2. API 응답과 컴포넌트 props 간의 타입 호환성 보장
 * 3. any 타입 사용 제거 및 명확한 타입 안전성 제공
 * 
 * 핵심 특징:
 * - shared/schema.ts의 Canvas 타입과 완벽 호환
 * - 컴포넌트별 필요한 부분 타입(Partial Type) 제공
 * - 런타임 타입 검증을 위한 타입 가드 함수 포함
 * 
 * 주의사항:
 * - Canvas 타입은 데이터베이스 스키마와 정확히 일치해야 함
 * - 컴포넌트 props는 실제 사용하는 필드만 포함
 * - 타입 변환 시 데이터 손실이 없도록 주의
 */

import type { Canvas as SchemaCanvas, CanvasState, Asset } from '@shared/schema';

/**
 * 데이터베이스 Canvas 타입 (shared/schema.ts에서 가져옴)
 */
export type DatabaseCanvas = SchemaCanvas;

/**
 * 컴포넌트에서 사용하는 Canvas 타입
 * 데이터베이스 타입과 레거시 API 응답 형식을 모두 지원
 */
export interface CanvasViewData {
  id: string;
  title: string;
  workspaceId: string;
  workspace_id?: string; // 레거시 필드 지원
  createdAt: Date | null;
  updatedAt: Date | null;
  templateId: string | null;
  createdBy: string;
  created_by?: string; // 레거시 필드 지원
  is_public?: boolean; // 레거시 필드 지원
}

/**
 * CanvasView 컴포넌트 Props 타입
 */
export interface CanvasViewProps {
  canvas: CanvasViewData;
  canvasState?: CanvasState;
  isPublic?: boolean;
  readOnly?: boolean;
}

/**
 * CanvasArea 컴포넌트에서 기대하는 Canvas 타입
 * shared/schema.ts의 Canvas 타입과 정확히 일치
 */
export interface CanvasAreaCanvas {
  id: string;
  title: string;
  workspaceId: string;
  createdAt: Date | null;
  updatedAt: Date | null;
  templateId: string | null;
  createdBy: string;
}

/**
 * Node 관련 타입 정의
 */
export interface NodeData {
  title: string;
  subtitle?: string;
  icon: string;
  color: string;
  size?: "small" | "medium" | "large";
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface FlowNode {
  id: string;
  type: string;
  data: NodeData;
  position: NodePosition;
  selected?: boolean;
  dragging?: boolean;
}

/**
 * Edge 관련 타입 정의
 */
export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  data?: Record<string, unknown>;
}

/**
 * Canvas 상태 관리 타입
 */
export interface FlowData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

/**
 * 메모 관련 타입 정의
 */
export interface MemoPosition {
  x: number;
  y: number;
}

export interface MemoSize {
  width: number;
  height: number;
}

export interface TextMemoData {
  id: string;
  canvasId: string;
  content: string;
  position: MemoPosition;
  size?: MemoSize;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Todo 관련 타입 정의
 */
export interface TodoItem {
  id: string;
  canvasId: string;
  text: string;
  completed: boolean;
  position: number;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Asset 관련 타입 정의
 */
export type CanvasAsset = Asset;

/**
 * 업로드 관련 타입 정의
 */
export type UploadType = "pdf" | "youtube" | "url";

/**
 * 타입 가드 함수들
 */

/**
 * Canvas 객체가 CanvasAreaCanvas 타입인지 확인
 */
export function isCanvasAreaCanvas(canvas: unknown): canvas is CanvasAreaCanvas {
  if (!canvas || typeof canvas !== 'object') return false;
  
  const c = canvas as Record<string, unknown>;
  
  return (
    typeof c.id === 'string' &&
    typeof c.title === 'string' &&
    typeof c.workspaceId === 'string' &&
    typeof c.createdBy === 'string' &&
    (c.createdAt === null || c.createdAt instanceof Date) &&
    (c.updatedAt === null || c.updatedAt instanceof Date) &&
    (c.templateId === null || typeof c.templateId === 'string')
  );
}

/**
 * Canvas 데이터를 CanvasAreaCanvas 형식으로 변환
 */
export function toCanvasAreaCanvas(canvas: CanvasViewData): CanvasAreaCanvas {
  return {
    id: canvas.id,
    title: canvas.title,
    workspaceId: canvas.workspaceId || canvas.workspace_id || '',
    createdAt: canvas.createdAt,
    updatedAt: canvas.updatedAt,
    templateId: canvas.templateId,
    createdBy: canvas.createdBy || canvas.created_by || '',
  };
}

/**
 * 레거시 Canvas 응답을 CanvasViewData로 변환
 */
export function toLegacyCanvas(canvas: DatabaseCanvas): CanvasViewData {
  return {
    id: canvas.id,
    title: canvas.title,
    workspaceId: canvas.workspaceId,
    workspace_id: canvas.workspaceId, // 레거시 호환성
    createdAt: canvas.createdAt,
    updatedAt: canvas.updatedAt,
    templateId: canvas.templateId,
    createdBy: canvas.createdBy,
    created_by: canvas.createdBy, // 레거시 호환성
  };
}

/**
 * FlowNode 배열이 유효한지 검증
 */
export function validateFlowNodes(nodes: unknown): nodes is FlowNode[] {
  if (!Array.isArray(nodes)) return false;
  
  return nodes.every(node => 
    node &&
    typeof node === 'object' &&
    typeof (node as FlowNode).id === 'string' &&
    typeof (node as FlowNode).type === 'string' &&
    node.hasOwnProperty('data') &&
    node.hasOwnProperty('position') &&
    typeof (node as FlowNode).position.x === 'number' &&
    typeof (node as FlowNode).position.y === 'number'
  );
}

/**
 * FlowEdge 배열이 유효한지 검증
 */
export function validateFlowEdges(edges: unknown): edges is FlowEdge[] {
  if (!Array.isArray(edges)) return false;
  
  return edges.every(edge => 
    edge &&
    typeof edge === 'object' &&
    typeof (edge as FlowEdge).id === 'string' &&
    typeof (edge as FlowEdge).source === 'string' &&
    typeof (edge as FlowEdge).target === 'string'
  );
}
