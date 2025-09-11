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
import {buildOptimalActionDecisionPrompt, buildAnswerSynthesisPrompt, DEFAULT_SYSTEM_PROMPT_HEADER, type OptimalActionDecisionResponse, type OptimalAction } from '@/services/rag';

interface BuildContextParams {
  supabase: any;
  canvasId: string;
  message: string;
  historyText?: string;
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
    const { supabase, canvasId, message, historyText } = params;
    
    const { matchedChunks, ragSuccess } = await this.searchKnowledge({ supabase, canvasId, message });
    
    const knowledgeContext = await this.composeKnowledgeContext({ supabase, canvasId, matchedChunks, ragSuccess });

    // 추가: 글로벌 지식 매칭 및 컨텍스트 결합
    const globalContext = await this.composeGlobalKnowledgeContext({ supabase, message });
    
    // 지식 우선: 충분하면 웹 검색 생략, 부족하면 검색
    const { webCitations, webContext, actionDecision } = await this.maybeSearchWeb(message, {
      ragSuccess,
      matchedChunks,
      knowledgeContext,
      globalContext,
    }, historyText);

    const fullContext = knowledgeContext
      + (globalContext ? '\n\n🌐 글로벌 지식:\n' + globalContext : '')
      + (webContext ? '\n\n최신 웹 검색 결과:\n' + webContext : '');

    const knowledgeCitations = await this.buildKnowledgeCitations({ supabase, matchedChunks });
    return {
      knowledgeContext: fullContext,
      knowledgeCitations,
      webCitations,
      webContext,
      ragUsed: {
        chunksMatched: matchedChunks.length,
        webSearchUsed: webContext.length > 0,
      },
      actionDecision,
    };
  }

  /**
   * 지식 우선 여부를 GPT로 판정: 지식으로 충분히 답변 가능하면 true, 아니면 false
   */
  async decideUseKnowledgeFirst(knowledgeContext: string, userMessage: string): Promise<boolean> {
    // Deprecated: 더 이상 사용하지 않음. 새 액션 결정 플로우로 대체됨.
    return false;
  }

  /**
   * 지식 전용 답변 생성 (웹 검색 금지)
   */
  async answerFromKnowledgeOnly(params: { knowledgeContext: string; historyText: string; message: string; externalInstruction?: string; }): Promise<string> {
    const { knowledgeContext, historyText, message } = params;
    // 지식 기반: 기본 헤더(페르소나/규칙) 적용
    const system = buildAnswerSynthesisPrompt(knowledgeContext, historyText, message, params.externalInstruction ?? DEFAULT_SYSTEM_PROMPT_HEADER);
    return this.openaiService.chat(system, message, {
      maxTokens: 4000,
      temperature: 0.2,
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });
  }

  /**
   * 지식+웹 답변 생성 (Perplexity 에이전트 포함)
   */
  async answerFromKnowledgeAndWeb(params: { knowledgeContext: string; historyText: string; message: string; webCitations?: WebCitation[]; webContext?: string; externalInstruction?: string; }): Promise<{ content: string; webCitations: WebCitation[]; }> {
    const { knowledgeContext, historyText, message } = params;
    
    // 중복 검색 방지: 기존 검색 결과 재사용, 없으면 최소 조건으로 검색 시도
    let webCitations: WebCitation[] = Array.isArray(params.webCitations) ? params.webCitations : [];
    let webContext: string = typeof params.webContext === 'string' ? params.webContext : '';

    if (webContext.length === 0 && webCitations.length === 0) {
      const searched = await this.maybeSearchWeb(message, {
        ragSuccess: false,
        matchedChunks: [],
        knowledgeContext: '',
        globalContext: '',
      });
      webCitations = searched.webCitations;
      webContext = searched.webContext;
    }
    // 단일 시스템 프롬프트로 통합: 웹 컨텍스트가 있으면 지식 컨텍스트에 결합
    const mergedContext = knowledgeContext + (webContext ? `\n\n[웹 검색 결과]\n${webContext}` : '');
    const system = buildAnswerSynthesisPrompt(mergedContext, historyText, message, params.externalInstruction);

    // Perplexity 우선 시도 (검색+답변)
    try {
      const { content, citations } = await this.answerWithPerplexity(system, message, { maxTokens: 2500, temperature: 0.2 });
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
      }
      return { content, webCitations: mergedCitations };
    } catch {
      // 실패 시 OpenAI로 폴백
      const content = await this.openaiService.chat(system, message, {
        maxTokens: 4000,
        temperature: 0.2,
        presencePenalty: 0.1,
        frequencyPenalty: 0.1,
      });
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
      maxTokens: options?.maxTokens ?? 4000,
      temperature: options?.temperature ?? 0.2,
    });
    return { content, citations };
  }

  private async searchKnowledge({ supabase, canvasId, message }: { supabase: any; canvasId: string; message: string; }): Promise<{ matchedChunks: KnowledgeChunk[]; ragSuccess: boolean; }> {
    try {
      const embedding = await this.openaiService.generateEmbedding(message);

      // 캔버스 지식
      const { data: matchData, error: matchError } = await (supabase as any)
        .rpc('match_knowledge_chunks', {
          canvas_id: canvasId,
          query_embedding: embedding,
          match_count: 12,
          min_similarity: 0.70,
        });

      // 글로벌 지식
      const { data: globalData, error: globalError } = await (supabase as any)
        .rpc('match_global_knowledge_chunks', {
          query_embedding: embedding,
          match_count: 8,
          min_similarity: 0.70,
        });

      const combined: KnowledgeChunk[] = [];

      if (!matchError && Array.isArray(matchData)) {
        combined.push(
          ...matchData.map((m: any) => ({
            id: String(m.id),
            knowledge_id: String(m.knowledge_id),
            text: String(m.text || ''),
            similarity: typeof m.similarity === 'number' ? m.similarity : 0,
          }))
        );
      }

      if (!globalError && Array.isArray(globalData)) {
        combined.push(
          ...globalData.map((m: any) => ({
            id: String(m.id),
            knowledge_id: String(m.knowledge_id),
            text: String(m.text || ''),
            similarity: typeof m.similarity === 'number' ? m.similarity : 0,
          }))
        );
      }

      if (combined.length > 0) {
        combined.sort((a, b) => b.similarity - a.similarity);
        const top = combined.slice(0, 20);
        return { matchedChunks: top, ragSuccess: true };
      }
    } catch {
      // RAG 실패는 폴백으로 처리하므로 로깅만 하고 진행
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
          const similarityPercentage = this.convertToPercentage(chunk.similarity);
          return `${idx + 1}. [${docTitle}] (유사도: ${similarityPercentage.toFixed(1)}%)\n${chunk.text}`;
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

  /**
   * 글로벌 지식 컨텍스트 구성: 전역 청크 매칭 후 상위 일부를 요약 컨텍스트로 구성
   */
  private async composeGlobalKnowledgeContext({ supabase, message }: { supabase: any; message: string; }): Promise<string> {
    try {
      const embedding = await this.openaiService.generateEmbedding(message);
      const { data: matchData } = await (supabase as any)
        .rpc('match_global_knowledge_chunks', {
          query_embedding: embedding,
          match_count: 8,
          min_similarity: 0.70,
        });
      if (!Array.isArray(matchData) || matchData.length === 0) return '';

      // 관련 지식 제목 로드
      const uniqueIds = Array.from(new Set(matchData.map((m: any) => String(m.knowledge_id))));
      const { data: docs } = await (supabase as any)
        .from('global_ai_knowledge')
        .select('id, title')
        .in('id', uniqueIds);
      const titleMap = new Map<string, string>((docs || []).map((d: any) => [String(d.id), String(d.title)]));

      const top = matchData
        .map((m: any) => ({
          id: String(m.id),
          knowledge_id: String(m.knowledge_id),
          text: String(m.text || ''),
          similarity: typeof m.similarity === 'number' ? m.similarity : 0,
        }))
        .sort((a: any, b: any) => b.similarity - a.similarity)
        .slice(0, 6);

      const lines = top.map((c: any, idx: number) => {
        const title = titleMap.get(c.knowledge_id) || '글로벌 지식';
        const similarityPercentage = this.convertToPercentage(c.similarity);
        return `${idx + 1}. [${title}] (유사도: ${similarityPercentage.toFixed(1)}%)\n${c.text}`;
      });

      return lines.join('\n\n');
    } catch {
      return '';
    }
  }

  private async maybeSearchWeb(message: string, context: { ragSuccess: boolean; matchedChunks: KnowledgeChunk[]; knowledgeContext: string; globalContext: string; }, historyText?: string): Promise<{ webCitations: WebCitation[]; webContext: string; actionDecision?: OptimalActionDecisionResponse; }> {
    // 액션 결정 프롬프트 기반으로 웹 검색 여부 및 검색어를 결정
    try {
      const parts: string[] = [];
      if ((context.knowledgeContext || '').trim().length > 0) parts.push(context.knowledgeContext.trim());
      if ((context.globalContext || '').trim().length > 0) parts.push(context.globalContext.trim());
      if ((historyText || '').trim().length > 0) parts.push(`🗣️ 최근 대화 맥락:\n${historyText!.trim()}`);
      const knowledgeSnippet = parts.join('\n\n');
      
      const system = buildOptimalActionDecisionPrompt(message, knowledgeSnippet);
      const decisionRaw = await this.openaiService.chat(system, '위 지시에 따라 JSON만 응답하세요.', { maxTokens: 200, temperature: 0 });
      
      let parsed: OptimalActionDecisionResponse | null = null;
      try {
        parsed = JSON.parse(decisionRaw) as OptimalActionDecisionResponse;
      } catch (parseError) {
        // JSON 파싱 실패 시 웹 검색 보수적 폴백: 지식 충분성으로 대체 판단
        const hasKnowledge = this.hasSufficientKnowledge(context);
        if (hasKnowledge) {
          return { webCitations: [], webContext: '', actionDecision: { action: 'KNOWLEDGE_ONLY', reason: 'Knowledge sufficient by heuristic', searchQuery: null, clarificationQuestion: null } };
        }
        // 검색어는 사용자 메시지를 그대로 활용
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
        return { webCitations, webContext, actionDecision: { action: 'WEB_SEARCH', reason: 'JSON parse failed; fallback search by user message', searchQuery: message, clarificationQuestion: null } };
      }

      const action: OptimalAction = parsed?.action || 'CLARIFY';
      
      if (action === 'KNOWLEDGE_ONLY' || action === 'CLARIFY' || action === 'CONVERSATION_SUMMARY' || action === 'KNOWLEDGE_SUMMARY') {
        // Clarify는 상위 호출부에서 후속질문을 유도하도록 처리 가능. 여기서는 검색 생략
        return { webCitations: [], webContext: '', actionDecision: parsed ?? { action, reason: 'Knowledge only/clarify/summary', searchQuery: null, clarificationQuestion: null } };
      }

      // WEB_SEARCH: 검색 실행
      const query = (parsed?.searchQuery && parsed.searchQuery.trim().length > 0) ? parsed.searchQuery : message;
      
      const searchResponse = await this.webSearchService.searchWeb(query, 5);
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
      return { webCitations, webContext, actionDecision: parsed ?? { action: 'WEB_SEARCH', reason: 'Search executed', searchQuery: query, clarificationQuestion: null } };
    } catch {
      return { webCitations: [], webContext: '', actionDecision: { action: 'KNOWLEDGE_ONLY', reason: 'Search failed; fallback to knowledge', searchQuery: null, clarificationQuestion: null } };
    }
  }

  /**
   * 지식 요약용 전체 컨텍스트 구성 (번호/유사도 제거, 원문 중심)
   * - 캔버스 지식 전체를 제목+본문 형태로 결합
   * - 글로벌 지식은 관련 상위 일부를 문서별로 묶어 결합
   * - 최근 대화 맥락(historyText)이 있으면 후미에 추가
   */
  async buildFullSummaryContext(params: { supabase: any; canvasId: string; message?: string; includeGlobal?: boolean; historyText?: string; }): Promise<string> {
    const { supabase, canvasId, message, includeGlobal = true, historyText } = params;
    const parts: string[] = [];

    try {
      // 1) 캔버스 지식 전체 (최신순)
      const { data: allKnowledge } = await (supabase as any)
        .from('canvas_knowledge')
        .select('id, title, content')
        .eq('canvas_id', canvasId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (Array.isArray(allKnowledge) && allKnowledge.length > 0) {
        const docTexts = allKnowledge.map((k: any) => {
          const title = String(k.title || '지식 문서');
          const content = String(k.content || '').trim();
          return `# ${title}\n${content}`;
        });
        parts.push(docTexts.join('\n\n'));
      }

      // 2) 글로벌 지식 (관련 상위 청크를 문서별로 묶어 원문 중심으로 결합)
      if (includeGlobal && message && message.trim().length > 0) {
        try {
          const embedding = await this.openaiService.generateEmbedding(message);
          const { data: matchData } = await (supabase as any)
            .rpc('match_global_knowledge_chunks', {
              query_embedding: embedding,
              match_count: 12,
              min_similarity: 0.70,
            });

          if (Array.isArray(matchData) && matchData.length > 0) {
            const byDoc = new Map<string, { title: string; chunks: string[] }>();

            // 관련 지식 제목 로드
            const uniqueIds = Array.from(new Set(matchData.map((m: any) => String(m.knowledge_id))));
            const { data: docs } = await (supabase as any)
              .from('global_ai_knowledge')
              .select('id, title')
              .in('id', uniqueIds);
            const titleMap = new Map<string, string>((docs || []).map((d: any) => [String(d.id), String(d.title)]));

            for (const m of matchData.slice(0, 12)) {
              const kid = String(m.knowledge_id);
              const text = String(m.text || '');
              if (!byDoc.has(kid)) {
                byDoc.set(kid, { title: titleMap.get(kid) || '글로벌 지식', chunks: [] });
              }
              byDoc.get(kid)!.chunks.push(text);
            }

            const globalTexts: string[] = [];
            for (const [_, bundle] of byDoc) {
              const merged = bundle.chunks.join('\n');
              globalTexts.push(`# ${bundle.title}\n${merged}`);
            }
            if (globalTexts.length > 0) {
              parts.push(globalTexts.join('\n\n'));
            }
          }
        } catch {
        }
      }

      // 3) 최근 대화 맥락
      if ((historyText || '').trim().length > 0) {
        parts.push(`🗣️ 최근 대화 맥락:\n${historyText!.trim()}`);
      }
    } catch {
    }

    return parts.join('\n\n');
  }

  /**
   * 음수/양수 코사인 유사도를 0~100%로 변환해 직관적으로 비교
   */
  private convertToPercentage(similarity: number): number {
    return Math.max(0, Math.min(100, (similarity + 1) * 50));
  }

  /**
   * 지식 충분성 판정: 지식이 충분하면 웹 검색 생략
   */
  private hasSufficientKnowledge(context: { ragSuccess: boolean; matchedChunks: KnowledgeChunk[]; knowledgeContext: string; globalContext: string; }): boolean {
    const { ragSuccess, matchedChunks, knowledgeContext, globalContext } = context;

    

    if (!ragSuccess) {
      
      return false;
    }

    if (!Array.isArray(matchedChunks) || matchedChunks.length < 3) {
      
      return false;
    }

    const sorted = [...matchedChunks].sort((a, b) => b.similarity - a.similarity);
    const top = sorted[0]?.similarity ?? 0;
    const avgTop3 = (sorted.slice(0, 3).reduce((s, c) => s + (c.similarity || 0), 0) / Math.min(3, sorted.length)) || 0;
    const topPct = this.convertToPercentage(top);
    const avgPct = this.convertToPercentage(avgTop3);

    // 임계값: 매우 높음 95+, 높음 85+, 수용 75+
    const hasHighSimilarity = topPct >= 95 || (topPct >= 85 && avgPct >= 80) || (topPct >= 75 && matchedChunks.length >= 5);

    const totalContextLength = (knowledgeContext || '').length + (globalContext || '').length;
    const hasEnoughContext = totalContextLength >= 300;

    

    const isSufficient = hasHighSimilarity && hasEnoughContext;

    if (isSufficient) {
      
    } else {
      
    }

    return isSufficient;
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


