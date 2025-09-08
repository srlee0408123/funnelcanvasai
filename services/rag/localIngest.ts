/**
 * localIngest.ts - 캔버스 내부 데이터(RAG 로컬 지식) 인입 유틸리티
 * 
 * 주요 역할:
 * 1. 노드/메모/할일 데이터를 canvas_knowledge에 통합 텍스트로 저장
 * 2. 저장된 본문을 청크로 분할하고 임베딩 생성하여 knowledge_chunks에 반영
 * 3. RAG 검색에서 내부 편집 데이터가 함께 활용되도록 보장
 * 
 * 핵심 특징:
 * - 각 카테고리별 단일 Knowledge 문서(메타: kind=nodes|memos|todos)로 관리
 * - 청크 교체 방식으로 최신 상태 유지 (기존 청크 삭제 후 재삽입)
 * - OpenAI 임베딩과 LangChain 텍스트 스플리터 재사용
 * 
 * 주의사항:
 * - 호출 실패는 비즈니스 로직을 막지 않도록 swallow (로그만 남김)
 * - 대용량 본문은 청크/배치 임베딩을 사용하여 성능 고려
 */

import { OpenAIService } from '@/services/openai';
import { buildChunks } from '@/services/textChunker';

type SupabaseClientLike = any; // Supabase service client (run-time validated)



async function replaceKnowledgeChunks(params: {
  supabase: SupabaseClientLike;
  canvasId: string;
  knowledgeId: string;
  texts: string[];
}): Promise<void> {
  const { supabase, canvasId, knowledgeId, texts } = params;
  if (!Array.isArray(texts) || texts.length === 0) {
    // 빈 텍스트는 청크를 비웁니다
    await supabase.from('knowledge_chunks').delete().eq('knowledge_id', knowledgeId);
    return;
  }

  const ai = new OpenAIService();
  try {
    const embeddings = await ai.generateEmbeddingsBatch(texts);

    // 기존 청크 삭제 후 재삽입
    await supabase.from('knowledge_chunks').delete().eq('knowledge_id', knowledgeId);

    const inserts = texts.map((text, idx) => ({
      canvas_id: canvasId,
      knowledge_id: knowledgeId,
      seq: idx + 1,
      text,
      embedding: (embeddings && embeddings[idx] as unknown as any) ?? null,
    }));

    const { error: insertError } = await supabase
      .from('knowledge_chunks')
      .upsert(inserts, { onConflict: 'knowledge_id,seq' });
    if (insertError) {
      console.error('Failed to insert knowledge chunks:', insertError);
    }
  } catch (error) {
    console.error('Embedding generation failed while replacing knowledge chunks:', error);
  }
}

function splitToChunks(_fullText: string): string[] {
  // 동기 버전은 더 이상 사용하지 않습니다. buildChunks를 사용하세요.
  return [];
}

export { buildChunks };

function formatNodeLine(node: { node_id?: string; type?: string; data?: Record<string, any> }): string {
  const title = node?.data?.title ? String(node.data.title) : '제목 없음';
  const subtitle = node?.data?.subtitle ? ` - ${String(node.data.subtitle)}` : '';
  const type = node?.type ? `[${String(node.type)}] ` : '';
  return `- ${type}${title}${subtitle}`;
}

function formatTodosSection(todos: Array<{ text: string; completed: boolean }>): { incomplete: string[]; complete: string[] } {
  const incomplete: string[] = [];
  const complete: string[] = [];
  for (const t of todos) {
    const line = `- ${t.text}`;
    if (t.completed) complete.push(line);
    else incomplete.push(line);
  }
  return { incomplete, complete };
}

async function upsertSingleKnowledge(params: {
  supabase: SupabaseClientLike;
  canvasId: string;
  kind: 'nodes' | 'memos' | 'todos';
  title: string;
  content: string;
  metadata?: Record<string, any>;
}): Promise<string | null> {
  const { supabase, canvasId, kind, title, content, metadata = {} } = params;

  // 기존 문서 탐색 (메타데이터 kind 로 매칭)
  const { data: existingDocs, error: findError } = await supabase
    .from('canvas_knowledge')
    .select('id')
    .eq('canvas_id', canvasId)
    .contains('metadata', { kind });

  if (findError) {
    console.error('Failed to lookup existing knowledge for kind:', kind, findError);
  }

  const baseRow = {
    canvas_id: canvasId,
    type: 'text',
    title,
    content,
    metadata: { ...metadata, kind, system: 'internal' },
  };

  if (Array.isArray(existingDocs) && existingDocs.length > 0) {
    const knowledgeId = existingDocs[0].id as string;
    const { error: updateError } = await (supabase as any)
      .from('canvas_knowledge')
      .update({
        title,
        content,
        metadata: { ...metadata, kind, system: 'internal' },
      })
      .eq('id', knowledgeId);

    if (updateError) {
      console.error('Failed to update existing knowledge:', updateError);
      return null;
    }
    return knowledgeId;
  }

  const { data: inserted, error: insertError } = await (supabase as any)
    .from('canvas_knowledge')
    .insert(baseRow)
    .select('id')
    .single();

  if (insertError) {
    console.error('Failed to insert new knowledge:', insertError);
    return null;
  }
  return inserted?.id ?? null;
}

export async function upsertCanvasNodesKnowledge(params: {
  supabase: SupabaseClientLike;
  canvasId: string;
  nodes?: Array<{ node_id: string; type: string; data: Record<string, any> }>;
}): Promise<void> {
  const { supabase, canvasId } = params;
  try {
    // 1) 최신 canvas_states에서 노드 로드 (주 소스)
    type FlowNodeLike = { id?: string; type?: string; data?: Record<string, any> };
    let flowNodes: FlowNodeLike[] | null = null;

    try {
      const { data: stateRow } = await supabase
        .from('canvas_states')
        .select('state')
        .eq('canvas_id', canvasId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      const nodesFromState = (stateRow?.state as any)?.nodes;
      if (Array.isArray(nodesFromState)) {
        flowNodes = nodesFromState as FlowNodeLike[];
      }
    } catch (e) {
      // state가 없거나 실패해도 계속 진행 (fallback 사용)
      flowNodes = null;
    }

    // 2) 소스 확정 + todo 노드 제외 필터 (canvas_nodes 폴백 제거)
    const isTodoLike = (n: { id?: string; node_id?: string; type?: string }) => {
      const t = (n?.type || '').toString().toLowerCase();
      const id = (n?.id || n?.node_id || '').toString();
      return t === 'todo' || id.startsWith('todo-');
    };

    const normalizedNodes: Array<{ node_id?: string; type?: string; data?: Record<string, any> }> =
      (flowNodes ?? [])
        .filter((n) => !isTodoLike(n))
        .map((n) => ({
          // canvas_states 기반 노드는 node_id가 없을 수 있으므로 id를 보존
          node_id: (n as any).node_id ?? (n as any).id ?? undefined,
          type: n.type ?? '',
          data: n.data ?? {},
        }));

    const lines = normalizedNodes.map((n) => formatNodeLine(n));
    const header = '캔버스 노드 요약\n\n다음은 현재 캔버스에 배치된 노드 목록입니다:';
    const content = [header, ...lines].join('\n');

    const knowledgeId = await upsertSingleKnowledge({
      supabase,
      canvasId,
      kind: 'nodes',
      title: 'Nodes Data',
      content,
      metadata: { nodeCount: normalizedNodes.length },
    });

    if (!knowledgeId) return;
    const chunks = await buildChunks(content);
    await replaceKnowledgeChunks({ supabase, canvasId, knowledgeId, texts: chunks });
  } catch (error) {
    console.error('upsertCanvasNodesKnowledge failed:', error);
  }
}

export async function upsertCanvasMemosKnowledge(params: {
  supabase: SupabaseClientLike;
  canvasId: string;
}): Promise<void> {
  const { supabase, canvasId } = params;
  try {
    const { data: memos } = await supabase
      .from('text_memos')
      .select('id, content')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true });

    const items = (memos || []).map((m: any, idx: number) => `${idx + 1}. ${String(m.content || '').trim()}`);
    const header = '캔버스 메모 모음\n\n캔버스에 작성된 텍스트 메모들입니다:';
    const content = [header, ...items].join('\n');

    const knowledgeId = await upsertSingleKnowledge({
      supabase,
      canvasId,
      kind: 'memos',
      title: 'Memos Data',
      content,
      metadata: { memoCount: memos?.length ?? 0 },
    });

    if (!knowledgeId) return;
    const chunks = await buildChunks(content);
    await replaceKnowledgeChunks({ supabase, canvasId, knowledgeId, texts: chunks });
  } catch (error) {
    console.error('upsertCanvasMemosKnowledge failed:', error);
  }
}

export async function upsertCanvasTodosKnowledge(params: {
  supabase: SupabaseClientLike;
  canvasId: string;
}): Promise<void> {
  const { supabase, canvasId } = params;
  try {
    const { data: todos } = await supabase
      .from('canvas_todos')
      .select('text, completed')
      .eq('canvas_id', canvasId)
      .order('position', { ascending: true });

    const list = (todos || []) as Array<{ text: string; completed: boolean }>;
    const sections = formatTodosSection(list);
    const lines: string[] = [];
    lines.push('할일(미완료):');
    lines.push(...(sections.incomplete.length > 0 ? sections.incomplete : ['- (없음)']));
    lines.push('\n할일(완료):');
    lines.push(...(sections.complete.length > 0 ? sections.complete : ['- (없음)']));

    const header = '캔버스 할일 체크리스트\n\n캔버스 관련 해야할 일 목록입니다:';
    const content = [header, ...lines].join('\n');

    const knowledgeId = await upsertSingleKnowledge({
      supabase,
      canvasId,
      kind: 'todos',
      title: 'Todos Data',
      content,
      metadata: { total: list.length, completed: sections.complete.length, incomplete: sections.incomplete.length },
    });

    if (!knowledgeId) return;
    const chunks = await buildChunks(content);
    await replaceKnowledgeChunks({ supabase, canvasId, knowledgeId, texts: chunks });
  } catch (error) {
    console.error('upsertCanvasTodosKnowledge failed:', error);
  }
}


