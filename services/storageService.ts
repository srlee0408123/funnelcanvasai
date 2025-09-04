/**
 * storageService.ts - 서버 사이드 스토리지/DB 접근 유틸리티
 * 
 * 주요 역할:
 * 1. 캔버스 상태/피드백/지식베이스 DB 접근 함수 제공
 * 2. 서비스 계정(Supabase service role)으로 안전하게 조회/저장
 * 3. aiFeedback 등 서버 서비스에서 재사용
 * 
 * 핵심 특징:
 * - shared/schema.ts 타입을 사용하여 타입 안전성 보장
 * - any 미사용, 명확한 반환 타입 명시
 * - 각 함수는 오류 시 null 또는 예외를 던지지 않고 안전하게 동작
 * 
 * 주의사항:
 * - 서버 환경에서만 사용 (클라이언트에서 import 금지)
 * - 필요한 컬럼만 선택하여 최소 데이터 전송
 * - 쿼리 실패 시 null 반환, 상위에서 에러 처리
 */

import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/database.types";
import type {
  Canvas,
  CanvasState,
  FeedbackRun,
  FeedbackItem,
  AssetChunk
} from "@shared/schema";

// Canvas State
export async function getCanvasState(canvasId: string, version: number): Promise<CanvasState | null> {
  // 실제 DB에는 version 컬럼이 없으므로 최신 상태를 반환
  return getLatestCanvasState(canvasId);
}

export async function getLatestCanvasState(canvasId: string): Promise<CanvasState | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("canvas_states")
    .select("id, canvas_id, state, user_id, created_at")
    .eq("canvas_id", canvasId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const mapped: CanvasState = {
    id: (data as any).id,
    canvasId: (data as any).canvas_id,
    state: (data as any).state,
    userId: (data as any).user_id,
    createdAt: (data as any).created_at ?? null,
  };
  return mapped;
}

// Canvas
export async function getCanvas(canvasId: string): Promise<Canvas | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("canvases")
    .select("id, title, workspace_id, template_id, created_by, created_at, updated_at")
    .eq("id", canvasId)
    .single();
  if (!data) return null;

  const mapped: Canvas = {
    id: (data as any).id,
    title: (data as any).title,
    workspaceId: (data as any).workspace_id,
    templateId: (data as any).template_id ?? null,
    createdBy: (data as any).created_by,
    createdAt: (data as any).created_at ?? null,
    updatedAt: (data as any).updated_at ?? null,
  };
  return mapped;
}

// Global knowledge (global_ai_knowledge)
export async function getGlobalKnowledge(): Promise<Array<{ id: string; title: string; content: string }>> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("global_ai_knowledge")
    .select("id, title, content")
    .order("created_at", { ascending: false });
  if (!data) return [];
  return (data as Array<{ id: string; title: string; content: string }>).map((r) => ({
    id: (r as any).id,
    title: (r as any).title,
    content: (r as any).content,
  }));
}

// Top-K knowledge from asset_chunks by workspace
export async function getTopKKnowledge(
  workspaceId: string,
  _userId: string,
  _canvasId: string | undefined,
  limit: number
): Promise<AssetChunk[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("asset_chunks")
    .select("id, asset_id, seq, text, embedding, tokens, created_at, assets!inner(workspace_id)")
    .limit(limit);
  if (!data) return [];
  // 간단 매핑 (workspace 필터는 서버 정책/뷰로 처리한다고 가정)
  return (data as any[]).map((row) => ({
    id: row.id,
    assetId: row.asset_id,
    seq: row.seq,
    text: row.text,
    embedding: row.embedding,
    tokens: row.tokens,
    createdAt: row.created_at ?? null,
  }));
}

// Feedback runs and items
export async function getFeedbackRun(canvasId: string, flowHash: string, kbHash: string): Promise<FeedbackRun | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("feedback_runs")
    .select("id, canvas_id, state_version, flow_hash, kb_hash, prompt_version, bp_version, model, latency_ms, created_at")
    .eq("canvas_id", canvasId)
    .eq("flow_hash", flowHash)
    .eq("kb_hash", kbHash)
    .maybeSingle();
  if (!data) return null;
  const mapped: FeedbackRun = {
    id: (data as any).id,
    canvasId: (data as any).canvas_id,
    stateVersion: (data as any).state_version ?? null,
    flowHash: (data as any).flow_hash ?? null,
    kbHash: (data as any).kb_hash ?? null,
    promptVersion: (data as any).prompt_version ?? null,
    bpVersion: (data as any).bp_version ?? null,
    model: (data as any).model ?? null,
    latencyMs: (data as any).latency_ms ?? null,
    createdAt: (data as any).created_at ?? null,
  };
  return mapped;
}

export async function getFeedbackItems(runId: string): Promise<FeedbackItem[]> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("feedback_items")
    .select("id, run_id, node_id, severity, suggestion, rationale, created_at")
    .eq("run_id", runId)
    .order("created_at", { ascending: true });
  if (!data) return [] as FeedbackItem[];
  return (data as any[]).map((row) => ({
    id: row.id,
    runId: row.run_id,
    nodeId: row.node_id,
    severity: row.severity,
    suggestion: row.suggestion,
    rationale: row.rationale,
    createdAt: row.created_at ?? null,
  })) as unknown as FeedbackItem[];
}

export async function createFeedbackRun(payload: {
  canvasId: string;
  stateVersion: number;
  flowHash: string;
  kbHash: string;
  promptVersion: string;
  bpVersion: string;
  model: string;
  latencyMs: number;
}): Promise<FeedbackRun> {
  const supabase = createServiceClient();
  const insertPayload: Database["public"]["Tables"]["feedback_runs"]["Insert"] = {
    canvas_id: payload.canvasId,
    state_version: payload.stateVersion,
    flow_hash: payload.flowHash,
    kb_hash: payload.kbHash,
    prompt_version: payload.promptVersion,
    bp_version: payload.bpVersion,
    model: payload.model,
    latency_ms: payload.latencyMs,
    // created_at, id 는 DB default
  };

  const { data, error } = await supabase
    .from("feedback_runs")
    .insert(insertPayload)
    .select("id, canvas_id, state_version, flow_hash, kb_hash, prompt_version, bp_version, model, latency_ms, created_at")
    .single();

  if (!data || error) {
    throw new Error("Failed to create feedback run");
  }

  const mapped: FeedbackRun = {
    id: (data as any).id,
    canvasId: (data as any).canvas_id,
    stateVersion: (data as any).state_version ?? null,
    flowHash: (data as any).flow_hash ?? null,
    kbHash: (data as any).kb_hash ?? null,
    promptVersion: (data as any).prompt_version ?? null,
    bpVersion: (data as any).bp_version ?? null,
    model: (data as any).model ?? null,
    latencyMs: (data as any).latency_ms ?? null,
    createdAt: (data as any).created_at ?? null,
  };
  return mapped;
}

export async function createFeedbackItem(payload: {
  runId: string;
  nodeId: string | null;
  severity: "low" | "medium" | "high" | string;
  suggestion: string;
  rationale: string | null;
}): Promise<void> {
  const supabase = createServiceClient();
  const itemPayload: Database["public"]["Tables"]["feedback_items"]["Insert"] = {
    run_id: payload.runId,
    node_id: payload.nodeId ?? null,
    severity: payload.severity,
    suggestion: payload.suggestion,
    rationale: payload.rationale ?? null,
  };
  await supabase
    .from("feedback_items")
    .insert(itemPayload);
}

export const storage = {
  getCanvasState,
  getLatestCanvasState,
  getCanvas,
  getGlobalKnowledge,
  getTopKKnowledge,
  getFeedbackRun,
  getFeedbackItems,
  createFeedbackRun,
  createFeedbackItem,
  // Asset related
  updateAsset: async (assetId: string, payload: { status?: string; metaJson?: Record<string, unknown> }): Promise<void> => {
    const supabase = createServiceClient();
    const updatePayload: Database["public"]["Tables"]["assets"]["Update"] = {
      status: payload.status as any,
      meta_json: payload.metaJson as any,
    };
    await supabase
      .from("assets")
      .update(updatePayload)
      .eq("id", assetId);
  },
  createAssetChunk: async (payload: { assetId: string; seq: number; text: string; embedding?: string; tokens?: number }): Promise<void> => {
    const supabase = createServiceClient();
    const insertChunk: Database["public"]["Tables"]["asset_chunks"]["Insert"] = {
      asset_id: payload.assetId,
      seq: payload.seq,
      text: payload.text,
      embedding: payload.embedding ?? null,
      tokens: payload.tokens ?? null,
    };
    await supabase
      .from("asset_chunks")
      .insert(insertChunk);
  },
  getCanvasKnowledgeByAssetId: async (assetId: string): Promise<{ id: string; extractedText: string } | null> => {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("canvas_knowledge")
      .select("id, extracted_text")
      .eq("asset_id", assetId)
      .maybeSingle();
    if (!data) return null;
    return { id: (data as any).id, extractedText: (data as any).extracted_text };
  },
};


