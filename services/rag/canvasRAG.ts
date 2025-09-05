/**
 * canvasRAG.ts - 캔버스 전용 RAG 서비스 (오케스트레이터)
 * 
 * 주요 역할:
 * 1. 쿼리 임베딩 생성 → 벡터 검색 → 컨텍스트 구성 전체 파이프라인 수행
 * 2. RAG 성공 시 상위 청크 기반 컨텍스트, 실패 시 제한적 폴백 구성
 * 3. 지식/웹 인용 정보 생성 및 반환
 * 
 * 핵심 특징:
 * - 파이썬 RAGService 구조를 참고한 모듈화된 설계
 * - 검색/컨텍스트/인용 생성 로직을 API 라우트에서 분리
 * - 성능과 가독성을 위한 단계별 작은 함수 구성
 * 
 * 주의사항:
 * - Supabase 서비스 클라이언트 주입 필요
 * - 외부 호출자는 DB 저장(채팅 로그 등)과 응답 생성만 담당
 */

import { OpenAIService } from '@/services/openai';
import { WebSearchService } from '@/services/webSearch';
import { BuildContextResult, KnowledgeChunk, KnowledgeCitation, WebCitation } from '@/types/rag';

interface BuildContextParams {
  supabase: any;
  canvasId: string;
  message: string;
}

export class CanvasRAGService {
  private readonly openaiService: OpenAIService;
  private readonly webSearchService: WebSearchService;

  constructor(openaiService = new OpenAIService(), webSearchService = new WebSearchService()) {
    this.openaiService = openaiService;
    this.webSearchService = webSearchService;
  }

  /**
   * 전체 컨텍스트(지식+웹)와 인용, 사용 메타를 구성
   */
  async buildContext(params: BuildContextParams): Promise<BuildContextResult> {
    const { supabase, canvasId, message } = params;

    const { matchedChunks, ragSuccess } = await this.searchKnowledge({ supabase, canvasId, message });

    const knowledgeContext = await this.composeKnowledgeContext({ supabase, canvasId, matchedChunks, ragSuccess });

    const { webCitations, webContext } = await this.maybeSearchWeb(message);

    const fullContext = knowledgeContext + (webContext ? '\n\n최신 웹 검색 결과:\n' + webContext : '');

    const knowledgeCitations = await this.buildKnowledgeCitations({ supabase, matchedChunks });

    return {
      knowledgeContext: fullContext,
      knowledgeCitations,
      webCitations,
      ragUsed: {
        chunksMatched: matchedChunks.length,
        webSearchUsed: webContext.length > 0,
      },
    };
  }

  private async searchKnowledge({ supabase, canvasId, message }: { supabase: any; canvasId: string; message: string; }): Promise<{ matchedChunks: KnowledgeChunk[]; ragSuccess: boolean; }> {
    try {
      const embedding = await this.openaiService.generateEmbedding(message);

      const { data: matchData, error: matchError } = await (supabase as any)
        .rpc('match_knowledge_chunks', {
          canvas_id: canvasId,
          query_embedding: embedding,
          match_count: 12,
          min_similarity: 0.70,
        });

      if (!matchError && Array.isArray(matchData) && matchData.length > 0) {
        const matchedChunks: KnowledgeChunk[] = matchData.map((m: any) => ({
          id: String(m.id),
          knowledge_id: String(m.knowledge_id),
          text: String(m.text || ''),
          similarity: typeof m.similarity === 'number' ? m.similarity : 0,
        }));
        return { matchedChunks, ragSuccess: true };
      }
    } catch (error) {
      // RAG 실패는 폴백으로 처리하므로 로깅만 하고 진행
      console.warn('RAG embedding or match failed:', error);
    }
    return { matchedChunks: [], ragSuccess: false };
  }

  private async composeKnowledgeContext({ supabase, canvasId, matchedChunks, ragSuccess }: { supabase: any; canvasId: string; matchedChunks: KnowledgeChunk[]; ragSuccess: boolean; }): Promise<string> {
    let knowledgeContext = '';

    if (ragSuccess && matchedChunks.length > 0) {
      // 필요한 knowledge 문서만 조회
      const uniqueKnowledgeIds = Array.from(new Set(matchedChunks.map((c) => c.knowledge_id)));

      const { data: relevantKnowledge, error: knowledgeError } = await supabase
        .from('canvas_knowledge')
        .select('id, title, type, content, metadata')
        .in('id', uniqueKnowledgeIds);

      if (knowledgeError) {
        console.error('Error fetching RAG-matched knowledge:', knowledgeError);
        return knowledgeContext;
      }

      const docBestScore = new Map<string, number>();
      for (const c of matchedChunks) {
        const prev = docBestScore.get(c.knowledge_id) ?? 0;
        if (c.similarity > prev) docBestScore.set(c.knowledge_id, c.similarity);
      }

      const knowledgeById = new Map<string, any>((relevantKnowledge || []).map((k: any) => [k.id, k]));

      knowledgeContext += '\n\n🎯 질문과 관련된 지식:\n';

      const topChunks = matchedChunks
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, 8);

      knowledgeContext += topChunks
        .map((chunk, idx) => {
          const doc = knowledgeById.get(chunk.knowledge_id);
          const docTitle = doc?.title || '지식 항목';
          return `${idx + 1}. [${docTitle}] (유사도: ${(chunk.similarity * 100).toFixed(1)}%)\n${chunk.text}`;
        })
        .join('\n\n');

      return knowledgeContext;
    }

    // 폴백: 최신 업로드 문서 일부 제공
    const { data: fallbackKnowledge, error: fallbackError } = await supabase
      .from('canvas_knowledge')
      .select('id, title, type, content, metadata')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: false })
      .limit(8);

    if (fallbackError) {
      console.error('Error in fallback knowledge retrieval:', fallbackError);
      return knowledgeContext;
    }

    if (fallbackKnowledge && fallbackKnowledge.length > 0) {
      knowledgeContext += '\n\n📋 캔버스 업로드 자료 (최신순):\n';
      knowledgeContext += fallbackKnowledge
        .map((k: any) => `- ${k.title}: ${(String(k.content || '')).substring(0, 300)}...`)
        .join('\n');
    }

    return knowledgeContext;
  }

  private async maybeSearchWeb(message: string): Promise<{ webCitations: WebCitation[]; webContext: string; }> {
    const shouldSearch = this.webSearchService.shouldSearchWeb(message);
    if (!shouldSearch) {
      return { webCitations: [], webContext: '' };
    }

    try {
      const searchResponse = await this.webSearchService.searchWeb(message, 5);
      const webCitations: WebCitation[] = (searchResponse.results || [])
        .slice(0, 5)
        .map((r: any) => ({
          kind: 'web',
          title: String(r.title),
          url: String(r.link),
          source: r.source ? String(r.source) : undefined,
          snippet: String(r.snippet || ''),
          relevanceScore: typeof r.relevanceScore === 'number' ? r.relevanceScore : null,
        }));

      const webContext = this.webSearchService.formatSearchResults(searchResponse.results);
      return { webCitations, webContext };
    } catch (error) {
      console.error('Web search failed:', error);
      return { webCitations: [], webContext: '' };
    }
  }

  private async buildKnowledgeCitations({ supabase, matchedChunks }: { supabase: any; matchedChunks: KnowledgeChunk[]; }): Promise<KnowledgeCitation[]> {
    if (matchedChunks.length === 0) return [];
    const uniqueKnowledgeIds = Array.from(new Set(matchedChunks.map((c) => c.knowledge_id)));
    const { data: citationKnowledge } = await supabase
      .from('canvas_knowledge')
      .select('id, title')
      .in('id', uniqueKnowledgeIds);

    const knowledgeTitleMap = new Map<string, string>(
      (citationKnowledge || []).map((k: any) => [String(k.id), String(k.title)]) as [string, string][]
    );

    return matchedChunks
      .slice(0, 8)
      .map((c) => ({
        kind: 'knowledge' as const,
        chunkId: String(c.id),
        knowledgeId: String(c.knowledge_id),
        title: knowledgeTitleMap.get(String(c.knowledge_id)) || '지식 항목',
        snippet: String((c.text || '').substring(0, 300)),
        similarity: typeof c.similarity === 'number' ? c.similarity : 0,
      }));
  }
}


