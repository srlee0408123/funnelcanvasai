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
import { PerplexityService } from '@/services/perplexity';
import { BuildContextResult, KnowledgeChunk, KnowledgeCitation, WebCitation } from '@/types/rag';
import { buildKBOnlySystemPrompt, buildKBAndWebSystemPrompt } from '@/services/rag';

interface BuildContextParams {
  supabase: any;
  canvasId: string;
  message: string;
}

export class CanvasRAGService {
  private readonly openaiService: OpenAIService;
  private readonly webSearchService: WebSearchService;
  private readonly perplexityService: PerplexityService;

  constructor(openaiService = new OpenAIService(), webSearchService = new WebSearchService(), perplexityService = new PerplexityService()) {
    this.openaiService = openaiService;
    this.webSearchService = webSearchService;
    this.perplexityService = perplexityService;
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

  /**
   * 지식 우선 여부를 GPT로 판정: 지식으로 충분히 답변 가능하면 true, 아니면 false
   */
  async decideUseKnowledgeFirst(knowledgeContext: string, userMessage: string): Promise<boolean> {
    try {
      console.log('🤖 [판정 단계] 지식 베이스 충분성 판정 시작');
      console.log('📝 사용자 질문:', userMessage);
      console.log('📚 지식 컨텍스트 길이:', knowledgeContext.length, '자');
      
      const system = `당신은 판정기입니다. 아래 지식 컨텍스트만으로 사용자 질문에 충분히 정확하고 실무적인 답변이 가능한지 판정하세요.
응답은 반드시 대문자 TRUE 또는 FALSE 중 하나의 단어만 반환하십시오.
TRUE: 지식 컨텍스트만으로 답변 가능
FALSE: 지식 컨텍스트만으로 부족하여 추가 웹 검색 필요`;
      const decision = await this.openaiService.chat(system, `지식 컨텍스트:\n${knowledgeContext}\n\n질문:\n${userMessage}`, {
        maxTokens: 4,
        temperature: 0,
      });
      
      const isKBEnough = /\bTRUE\b/i.test(decision);
      console.log('🎯 [판정 결과] GPT 응답:', decision.trim());
      console.log('✅ [판정 결과] 지식 베이스만 사용:', isKBEnough ? 'YES (KB 전용)' : 'NO (KB+웹 검색)');
      
      return isKBEnough;
    } catch (error) {
      console.error('❌ [판정 오류] 판정 실패, 웹 검색으로 폴백:', error);
      return false;
    }
  }

  /**
   * 지식 전용 답변 생성 (웹 검색 금지)
   */
  async answerFromKnowledgeOnly(params: { knowledgeContext: string; historyText: string; message: string; }): Promise<string> {
    console.log('📚 [KB 전용] 지식 베이스만으로 답변 생성 시작');
    const { knowledgeContext, historyText, message } = params;
    const system = buildKBOnlySystemPrompt(knowledgeContext, historyText);
    const answer = await this.openaiService.chat(system, message, {
      maxTokens: 2500,
      temperature: 0.2,
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });
    console.log('✅ [KB 전용] 답변 생성 완료, 길이:', answer.length, '자');
    return answer;
  }

  /**
   * 지식+웹 답변 생성 (Perplexity 에이전트 포함)
   */
  async answerFromKnowledgeAndWeb(params: { knowledgeContext: string; historyText: string; message: string; }): Promise<{ content: string; webCitations: WebCitation[]; }> {
    console.log('🌐 [KB+웹] 지식 베이스 + 웹 검색 답변 생성 시작');
    const { knowledgeContext, historyText, message } = params;
    
    // 웹 검색
    console.log('🔍 [웹 검색] 시작...');
    const { webCitations, webContext } = await this.maybeSearchWeb(message);
    console.log('🔍 [웹 검색] 완료, 인용 수:', webCitations.length, '개, 컨텍스트 길이:', webContext.length, '자');
    
    const system = buildKBAndWebSystemPrompt(knowledgeContext, webContext, historyText);

    // Perplexity 우선 시도 (검색+답변)
    try {
      console.log('🚀 [Perplexity] 시도 중...');
      const { content, citations } = await this.answerWithPerplexity(system, message, { maxTokens: 2500, temperature: 0.2 });
      console.log('✅ [Perplexity] 성공, 답변 길이:', content.length, '자, citations:', citations.length, '개');
      
      const mergedCitations = [...webCitations];
      if (Array.isArray(citations) && citations.length > 0) {
        mergedCitations.push(...citations.slice(0, 5).map((url) => ({
          kind: 'web' as const,
          title: '출처',
          url: String(url),
          source: undefined,
          snippet: '',
          relevanceScore: null,
        })));
        console.log('🔗 [Perplexity] citations 병합 완료, 총', mergedCitations.length, '개');
      }
      return { content, webCitations: mergedCitations };
    } catch (error) {
      console.warn('⚠️ [Perplexity] 실패, OpenAI로 폴백:', error instanceof Error ? error.message : 'Unknown error');
      // 실패 시 OpenAI로 폴백
      const content = await this.openaiService.chat(system, message, {
        maxTokens: 2500,
        temperature: 0.2,
        presencePenalty: 0.1,
        frequencyPenalty: 0.1,
      });
      console.log('✅ [OpenAI 폴백] 답변 생성 완료, 길이:', content.length, '자');
      return { content, webCitations };
    }
  }

  /**
   * 메시지가 질문/웹탐색이 필요한 유형인지 판별하여 Perplexity 에이전트 사용 여부 결정
   */
  usePerplexityAgentFor(message: string): boolean {
    const lower = (message || '').toLowerCase();
    const isQuestionMark = message.trim().endsWith('?') || /\?$/.test(message.trim());
    const questionWords = /(어떻게|무엇|검색|언제|어디|왜|which|how|what|when|where|why)/i.test(message);
    const searchHeuristic = this.webSearchService.shouldSearchWeb(message);
    const timeSensitive = /(최신|recent|current|today|오늘|최근)/i.test(message);
    return isQuestionMark || questionWords || searchHeuristic || timeSensitive || lower.includes('검색');
  }

  /**
   * Perplexity를 사용하여 최종 답변 생성
   */
  async answerWithPerplexity(systemPrompt: string, userPrompt: string, options?: { maxTokens?: number; temperature?: number; }): Promise<{ content: string; citations: string[]; }> {
    const { content, citations } = await this.perplexityService.chat(systemPrompt, userPrompt, {
      maxTokens: options?.maxTokens ?? 2500,
      temperature: options?.temperature ?? 0.2,
    });
    return { content, citations };
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


