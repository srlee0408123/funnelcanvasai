/**
 * canvasOnboardingService.ts - 캔버스 온보딩(초기 AI 가이드) 클라이언트 서비스
 * 
 * 주요 역할:
 * 1. 온보딩 대화 전송(action: chat)
 * 2. 대화 종료 후 초안 노드/엣지 Flow 생성(action: finalize)
 * 3. 응답 검증 및 안전한 기본값 적용
 * 
 * 핵심 특징:
 * - apiRequest 유틸 사용으로 일관된 에러 처리
 * - JSON 스키마 유효성 검증 후 타입 안전한 값 반환
 * - 노출 최소화를 위해 오류 시 사용자 친화적 메시지를 상위 레이어로 전파
 * 
 * 주의사항:
 * - 서버 상태 저장은 이 서비스에서 하지 않습니다. 상위에서 Zustand/React Query로 저장하세요.
 */

import { apiRequest } from '@/lib/queryClient';
import type { FlowNode, FlowEdge } from '@/types/canvas';

export type OnboardingChatMessage = { role: 'user' | 'assistant'; content: string };

export interface FinalizeResult {
  summary: string;
  flow: { nodes: FlowNode[]; edges: FlowEdge[] };
}

function isValidNode(node: any): node is FlowNode {
  if (!node || typeof node !== 'object') return false;
  if (typeof node.id !== 'string') return false;
  if (typeof node.type !== 'string') return false;
  if (!node.data || typeof node.data !== 'object') return false;
  if (typeof node.data.title !== 'string') return false;
  if (typeof node.data.icon !== 'string') return false;
  if (typeof node.data.color !== 'string') return false;
  if (!node.position || typeof node.position !== 'object') return false;
  if (typeof node.position.x !== 'number' || typeof node.position.y !== 'number') return false;
  return true;
}

function isValidEdge(edge: any): edge is FlowEdge {
  if (!edge || typeof edge !== 'object') return false;
  if (typeof edge.id !== 'string') return false;
  if (typeof edge.source !== 'string') return false;
  if (typeof edge.target !== 'string') return false;
  return true;
}

export class CanvasOnboardingService {
  async chat(canvasId: string, messages: OnboardingChatMessage[]): Promise<string> {
    const res = await apiRequest('POST', `/api/canvases/${canvasId}/onboarding`, {
      action: 'chat',
      messages,
    });
    const json = await res.json();
    return String(json?.reply || '');
  }

  async finalize(canvasId: string, messages: OnboardingChatMessage[]): Promise<FinalizeResult> {
    const res = await apiRequest('POST', `/api/canvases/${canvasId}/onboarding`, {
      action: 'finalize',
      messages,
    });
    const json = await res.json();
    const summary = typeof json?.summary === 'string' ? json.summary : '';
    const nodesRaw = Array.isArray(json?.flow?.nodes) ? json.flow.nodes : [];
    const edgesRaw = Array.isArray(json?.flow?.edges) ? json.flow.edges : [];

    // 안전한 매핑
    const nodes: FlowNode[] = nodesRaw
      .filter(isValidNode)
      .map((n: FlowNode) => ({
        id: n.id,
        type: n.type || 'custom',
        data: {
          title: n.data?.title || '제목',
          subtitle: String(n.data?.subtitle || ''),
          icon: n.data?.icon || '📝',
          color: n.data?.color || '#3B82F6',
          size: (n.data as any)?.size || undefined,
        },
        position: {
          x: Number.isFinite(n.position?.x) ? n.position.x : 200,
          y: Number.isFinite(n.position?.y) ? n.position.y : 100,
        },
      }));

    const edges: FlowEdge[] = edgesRaw
      .filter(isValidEdge)
      .map((e: FlowEdge) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        data: e.data || {},
      }));

    return { summary, flow: { nodes, edges } };
  }
}

export const canvasOnboardingService = new CanvasOnboardingService();


