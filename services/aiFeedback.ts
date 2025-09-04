/**
 * aiFeedback.ts - 캔버스 퍼널 AI 피드백 서비스
 * 
 * 주요 역할:
 * 1. 캔버스 상태와 지식 베이스를 결합해 피드백 생성
 * 2. 동일 입력(flow/kb) 중복 호출 방지를 위한 해시 캐싱
 * 3. 피드백 실행 이력/아이템을 DB에 저장 및 재활용
 * 
 * 핵심 특징:
 * - Supabase 서비스 클라이언트를 사용해 서버 측 안전 접근
 * - 해시/정규화 로직을 유틸로 분리해 재사용성 향상
 * - 일관된 에러 처리(throw)로 상위에서 통합 핸들링
 * 
 * 주의사항:
 * - 프론트 스토리지 의존 금지(브라우저 localStorage 미사용)
 * - 모델/버전 등 하드코딩 지양(환경 변수/상수화)
 */
import { storage } from "./storageService";
import { OpenAIService, type FeedbackItem } from "./openai";
const openaiService = new OpenAIService();
import { generateFlowHash, generateKnowledgeHash } from "@/lib/hashUtils";
const FEEDBACK_PROMPT_VERSION = process.env.FEEDBACK_PROMPT_VERSION || "1.0";
const FEEDBACK_BP_VERSION = process.env.FEEDBACK_BP_VERSION || "1.0";

export interface FeedbackRequest {
  canvasId: string;
  stateVersion?: number;
  userId: string;
}

export interface FeedbackResponse {
  run: {
    id: string;
    canvasId: string;
    flowHash: string;
    kbHash: string;
    createdAt: Date;
  };
  items: FeedbackItem[];
}

export class AIFeedbackService {
  async generateFeedback(canvasId: string, stateVersion?: number, userId?: string): Promise<FeedbackResponse> {
    // Get canvas state
    const state = stateVersion 
      ? await storage.getCanvasState(canvasId, stateVersion)
      : await storage.getLatestCanvasState(canvasId);

    if (!state) {
      throw new Error("Canvas state not found");
    }

    const canvas = await storage.getCanvas(canvasId);
    if (!canvas) {
      throw new Error("Canvas not found");
    }

    // Generate flow and knowledge base hashes
    const flowHash = generateFlowHash(state.flowJson);
    const kbData = await this.getKnowledgeBase(canvas.workspaceId, userId);
    const kbHash = generateKnowledgeHash(kbData);

    // Check for cached feedback
    const existingRun = await storage.getFeedbackRun(canvasId, flowHash, kbHash);
    if (existingRun) {
      const items = await storage.getFeedbackItems(existingRun.id);
      return {
        run: {
          id: existingRun.id,
          canvasId: existingRun.canvasId,
          flowHash: existingRun.flowHash!,
          kbHash: existingRun.kbHash!,
          createdAt: existingRun.createdAt!,
        },
        items: items.map((item: any) => ({
          nodeId: item.nodeId!,
          suggestion: item.suggestion,
          severity: item.severity as "low" | "medium" | "high",
          rationale: item.rationale!,
        })),
      };
    }

    // Generate new feedback
    const startTime = Date.now();
    
    const feedbackItems = await openaiService.generateFunnelFeedback({
      flowJson: state.flowJson,
      knowledgeBase: kbData,
    });

    const latencyMs = Date.now() - startTime;

    // Save feedback run
    const feedbackRun = await storage.createFeedbackRun({
      canvasId,
      stateVersion: state.version,
      flowHash,
      kbHash,
      promptVersion: FEEDBACK_PROMPT_VERSION,
      bpVersion: FEEDBACK_BP_VERSION,
      model: (openaiService as any).chatModel ?? "gpt-4o",
      latencyMs,
    });

    // Save feedback items
    for (const item of feedbackItems) {
      await storage.createFeedbackItem({
        runId: feedbackRun.id,
        nodeId: item.nodeId,
        severity: item.severity,
        suggestion: item.suggestion,
        rationale: item.rationale,
      });
    }

    return {
      run: {
        id: feedbackRun.id,
        canvasId: feedbackRun.canvasId,
        flowHash: feedbackRun.flowHash!,
        kbHash: feedbackRun.kbHash!,
        createdAt: feedbackRun.createdAt!,
      },
      items: feedbackItems,
    };
  }

  private async getKnowledgeBase(workspaceId: string, userId?: string): Promise<Array<{
    title: string;
    content: string;
    source: string;
  }>> {
    const knowledgeBase: Array<{ title: string; content: string; source: string; }> = [];

    // Get global knowledge
    const globalKnowledge = await storage.getGlobalKnowledge();
    for (const item of globalKnowledge) {
      knowledgeBase.push({
        title: item.title,
        content: item.content,
        source: "Global Knowledge Base",
      });
    }

    // Canvas knowledge is handled at the canvas level, not user level
    // Individual canvas knowledge is passed separately via canvasId

    // Get asset chunks from workspace assets
    const assetChunks = await storage.getTopKKnowledge(workspaceId, userId || "", undefined, 10);
    for (const chunk of assetChunks) {
      knowledgeBase.push({
        title: `Asset Chunk ${chunk.seq}`,
        content: chunk.text,
        source: "Workspace Assets",
      });
    }

    return knowledgeBase;
  }

  // 하위 호환: 기존 퍼블릭 메서드는 필요 시 hashUtils를 re-export하거나 별도 유틸에서 사용하세요.
}

export const aiFeedbackService = new AIFeedbackService();
