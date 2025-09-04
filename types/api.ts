/**
 * API 관련 타입 정의
 * 
 * 주요 역할:
 * 1. API 요청/응답 타입의 일관성 보장
 * 2. 백엔드와 프론트엔드 간 타입 안전성 제공
 * 3. any 타입 사용 제거 및 명확한 인터페이스 정의
 * 
 * 핵심 특징:
 * - RESTful API 패턴에 따른 표준화된 응답 형식
 * - 에러 처리를 위한 타입 안전한 응답 구조
 * - Generic을 활용한 재사용 가능한 타입 정의
 * 
 * 주의사항:
 * - API 응답 형식은 백엔드와 정확히 일치해야 함
 * - 에러 응답도 타입 안전하게 처리
 * - 선택적 필드는 명시적으로 optional로 표시
 */

/**
 * 표준 API 응답 형식
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * 페이지네이션 메타데이터
 */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/**
 * 페이지네이션된 API 응답
 */
export interface PaginatedApiResponse<T = unknown> extends ApiResponse<T[]> {
  meta?: PaginationMeta;
}

/**
 * HTTP 메서드 타입
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * API 요청 설정
 */
export interface ApiRequestConfig {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  credentials?: RequestCredentials;
}

/**
 * Canvas 관련 API 타입
 */

// Canvas 생성 요청
export interface CreateCanvasRequest {
  title: string;
  workspaceId: string;
  templateId?: string;
}

// Canvas 업데이트 요청
export interface UpdateCanvasRequest {
  title?: string;
  templateId?: string;
}

// Canvas 목록 조회 응답
export interface CanvasListItem {
  id: string;
  title: string;
  workspaceId: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  templateId: string | null;
}

/**
 * Node 관련 API 타입
 */

// Node 생성 요청
export interface CreateNodeRequest {
  nodeId: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    title: string;
    subtitle?: string;
    icon: string;
    color: string;
    size?: "small" | "medium" | "large";
  };
  metadata?: Record<string, unknown>;
}

// Node 업데이트 요청
export interface UpdateNodeRequest {
  position?: {
    x: number;
    y: number;
  };
  data?: {
    title?: string;
    subtitle?: string;
    icon?: string;
    color?: string;
    size?: "small" | "medium" | "large";
  };
  metadata?: Record<string, unknown>;
}

// Node 응답
export interface NodeResponse {
  id: string;
  canvasId: string;
  nodeId: string;
  type: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    title: string;
    subtitle?: string;
    icon: string;
    color: string;
    size?: "small" | "medium" | "large";
  };
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Edge 관련 API 타입
 */

// Edge 생성 요청
export interface CreateEdgeRequest {
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type?: string;
  data?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// Edge 응답
export interface EdgeResponse {
  id: string;
  canvasId: string;
  edgeId: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Memo 관련 API 타입
 */

// Memo 생성 요청
export interface CreateMemoRequest {
  content: string;
  position: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
}

// Memo 업데이트 요청
export interface UpdateMemoRequest {
  content?: string;
  position?: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
}

// Memo 응답
export interface MemoResponse {
  id: string;
  canvasId: string;
  content: string;
  position: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Todo 관련 API 타입
 */

// Todo 생성 요청
export interface CreateTodoRequest {
  text: string;
  position?: number;
}

// Todo 업데이트 요청
export interface UpdateTodoRequest {
  text?: string;
  completed?: boolean;
  position?: number;
}

// Todo 응답
export interface TodoResponse {
  id: string;
  canvasId: string;
  text: string;
  completed: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Chat 관련 API 타입
 */

// Chat 메시지 전송 요청
export interface SendChatMessageRequest {
  content: string;
  role: 'user' | 'assistant';
}

// Chat 메시지 응답
export interface ChatMessageResponse {
  id: string;
  canvasId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

/**
 * Asset 관련 API 타입
 */

// Asset 업로드 요청
export interface UploadAssetRequest {
  type: 'pdf' | 'youtube' | 'url' | 'note';
  title: string;
  url?: string;
  fileRef?: string;
  metaJson?: Record<string, unknown>;
}

// Asset 응답
export interface AssetResponse {
  id: string;
  workspaceId: string;
  canvasId: string;
  type: string;
  url?: string;
  fileRef?: string;
  contentSha256?: string;
  title: string;
  metaJson?: Record<string, unknown>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
}

/**
 * Knowledge 관련 API 타입
 */

// Knowledge 생성 요청
export interface CreateKnowledgeRequest {
  assetId?: string;
  assetType: string;
  title: string;
  content: string;
  extractedText?: string;
  processedContent?: string;
  tags?: string[];
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
}

// Knowledge 응답
export interface KnowledgeResponse {
  id: string;
  canvasId: string;
  assetId?: string;
  assetType: string;
  title: string;
  content: string;
  extractedText?: string;
  processedContent?: string;
  tags?: string[];
  sourceUrl?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/**
 * Workspace 관련 API 타입
 */

// Workspace 생성 요청
export interface CreateWorkspaceRequest {
  name: string;
  plan?: string;
}

// Workspace 응답
export interface WorkspaceResponse {
  id: string;
  ownerUserId: string;
  name: string;
  plan: string;
  createdAt: string;
  updatedAt: string;
}

// Workspace 멤버 초대 요청
export interface InviteWorkspaceMemberRequest {
  userId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
}

// Workspace 멤버 응답
export interface WorkspaceMemberResponse {
  workspaceId: string;
  userId: string;
  role: string;
  invitedAt: string;
  user?: {
    id: string;
    email?: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
  };
}

/**
 * 에러 타입 정의
 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * 검색 관련 타입
 */
export interface SearchQuery {
  query: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
}

export interface SearchResult<T = unknown> {
  items: T[];
  total: number;
  query: string;
  took: number; // 검색 소요 시간 (ms)
}

/**
 * 파일 업로드 관련 타입
 */
export interface FileUploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileUploadResult {
  success: boolean;
  fileRef?: string;
  url?: string;
  error?: string;
}

/**
 * WebSocket 메시지 타입
 */
export interface WebSocketMessage<T = unknown> {
  type: string;
  payload: T;
  timestamp: number;
}

/**
 * 실시간 업데이트 타입
 */
export interface RealtimeUpdate {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
}

/**
 * 타입 가드 함수들
 */

/**
 * API 응답이 성공 응답인지 확인
 */
export function isSuccessResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: true; data: T } {
  return response.success === true && response.data !== undefined;
}

/**
 * API 응답이 에러 응답인지 확인
 */
export function isErrorResponse<T>(response: ApiResponse<T>): response is ApiResponse<T> & { success: false; error: string } {
  return response.success === false && typeof response.error === 'string';
}

/**
 * 객체가 ApiError인지 확인
 */
export function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as ApiError).code === 'string' &&
    typeof (error as ApiError).message === 'string'
  );
}
