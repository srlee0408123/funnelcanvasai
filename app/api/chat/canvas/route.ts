import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import OpenAI from 'openai';
import { WebSearchService } from '@/services/webSearch';

/**
 * AI 채팅 API 엔드포인트 - Canvas 전용
 * 
 * POST /api/chat/canvas
 * - message: 사용자 메시지
 * - canvasId: 캔버스 ID
 * 
 * 기능:
 * 1. 캔버스 지식 베이스 활용
 * 2. 웹 검색 결과 통합
 * 3. 마케팅 전문가 "두더지 AI" 페르소나
 * 4. 채팅 히스토리 저장
 */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const webSearchService = new WebSearchService();

export async function POST(request: NextRequest) {
  try {
    // Clerk 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { message, canvasId } = body;

    if (!message || !canvasId) {
      return NextResponse.json(
        { error: '메시지와 캔버스 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`🤖 AI Chat request from user ${userId} for canvas ${canvasId}`);

    // 서비스 클라이언트 생성 (RLS 우회)
    const supabase = createServiceClient();

    // 사용자 메시지 저장
    const { data: userMessage, error: userMessageError } = await (supabase as any)
      .from('chat_messages')
      .insert({
        canvas_id: canvasId,
        user_id: userId,
        role: 'user',
        content: message
      })
      .select()
      .single();

    if (userMessageError) {
      console.error('Error saving user message:', userMessageError);
    }

    // 최근 채팅 히스토리 조회 (컨텍스트용)
    const { data: chatHistoryData } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: false })
      .limit(10);
    const chatHistory = (chatHistoryData || []) as any[];

    // 질문 임베딩 생성 및 지식 청크 유사도 검색 (RAG 우선)
    let matchedChunks: Array<{ id: string; knowledge_id: string; text: string; similarity: number }> = [];
    let ragSuccess = false;
    
    try {
      const embedResp = await openai.embeddings.create({
        model: process.env.OPENAI_EMBEDDINGS_MODEL || 'text-embedding-3-small',
        input: message,
      });
      const queryEmbedding = embedResp.data?.[0]?.embedding as number[] | undefined;

      if (queryEmbedding && Array.isArray(queryEmbedding)) {
        console.log('🔍 Performing RAG search with embeddings...');
        
        // RPC 함수 호출로 유사도 기반 chunk 검색
        const { data: matchData, error: matchError } = await (supabase as any)
          .rpc('match_knowledge_chunks', {
            canvas_id: canvasId,
            query_embedding: queryEmbedding,
            match_count: 12,
            min_similarity: 0.70,
          });

        if (!matchError && Array.isArray(matchData) && matchData.length > 0) {
          matchedChunks = matchData.map((m: any) => ({
            id: m.id,
            knowledge_id: m.knowledge_id,
            text: m.text,
            similarity: typeof m.similarity === 'number' ? m.similarity : 0,
          }));
          ragSuccess = true;
          console.log(`✅ RAG search successful: ${matchedChunks.length} chunks matched`);
        } else {
          console.log('⚠️ RAG search returned no results above similarity threshold');
        }
      }
    } catch (e) {
      console.warn('RAG embedding or match failed:', e);
    }

    // 웹 검색이 필요한지 판단
    const shouldSearch = webSearchService.shouldSearchWeb(message);
    let searchContext = '';
    let webResults: Array<{ title: string; link: string; snippet: string; source?: string; relevanceScore?: number }>|undefined;

    if (shouldSearch) {
      try {
        console.log('🔍 Performing web search for context...');
        const searchResponse = await webSearchService.searchWeb(message, 5);
        webResults = searchResponse.results;
        searchContext = webSearchService.formatSearchResults(searchResponse.results);
        console.log(`✅ Web search completed: ${searchResponse.results.length} results`);
      } catch (error) {
        console.error('Web search failed:', error);
        searchContext = '';
      }
    }

    // 컨텍스트 구성 - RAG 우선, 필요시에만 폴백 조회
    let knowledgeContext = '';

    if (ragSuccess && matchedChunks.length > 0) {
      console.log('📚 Building context from RAG-matched chunks...');
      
      // 매칭된 chunk들의 knowledge_id 수집
      const uniqueKnowledgeIds = Array.from(new Set(matchedChunks.map((c) => c.knowledge_id)));
      
      // 필요한 knowledge 문서만 조회 (RAG 매칭 기반)
      const { data: relevantKnowledge, error: knowledgeError } = await supabase
        .from('canvas_knowledge')
        .select('id, title, type, content, metadata')
        .in('id', uniqueKnowledgeIds);

      if (knowledgeError) {
        console.error('Error fetching RAG-matched knowledge:', knowledgeError);
      } else if (relevantKnowledge && relevantKnowledge.length > 0) {
        // 문서 단위로 스코어 집계 (가장 유사한 청크의 스코어 사용)
        const docBestScore = new Map<string, number>();
        for (const c of matchedChunks) {
          const prev = docBestScore.get(c.knowledge_id) ?? 0;
          if (c.similarity > prev) docBestScore.set(c.knowledge_id, c.similarity);
        }

        // knowledge 문서를 맵으로 구성
        const knowledgeById = new Map<string, any>(
          relevantKnowledge.map((k: any) => [k.id, k])
        );

        // 유사도 스코어 순으로 정렬
        const rankedDocs = uniqueKnowledgeIds
          .map((id) => ({ id, score: docBestScore.get(id) ?? 0 }))
          .sort((a, b) => b.score - a.score)
          .map(({ id }) => knowledgeById.get(id))
          .filter(Boolean);

        // RAG 기반 컨텍스트 구성 (chunk 텍스트와 원문 결합)
        knowledgeContext += '\n\n🎯 질문과 관련된 지식:\n';
        
        // 상위 유사도 chunk들을 먼저 포함
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

        console.log(`✅ RAG context built with ${rankedDocs.length} documents, ${topChunks.length} chunks`);
      }
    } else {
      // RAG 실패 시 폴백: 제한적 조회
      console.log('⚠️ RAG failed, using fallback knowledge retrieval...');
      
      const { data: fallbackKnowledge, error: fallbackError } = await supabase
        .from('canvas_knowledge')
        .select('id, title, type, content, metadata')
        .eq('canvas_id', canvasId)
        .order('created_at', { ascending: false })
        .limit(8); // 제한적 조회

      if (fallbackError) {
        console.error('Error in fallback knowledge retrieval:', fallbackError);
      } else if (fallbackKnowledge && fallbackKnowledge.length > 0) {
        knowledgeContext += '\n\n📋 캔버스 업로드 자료 (최신순):\n';
        knowledgeContext += fallbackKnowledge
          .map((k: any) => `- ${k.title}: ${(k.content || '').substring(0, 300)}...`)
          .join('\n');
        
        console.log(`📋 Fallback context built with ${fallbackKnowledge.length} documents`);
      }
    }

    // 글로벌 지식 베이스 (선택적 추가)
    const { data: globalKnowledge, error: globalError } = await supabase
      .from('global_ai_knowledge')
      .select('*')
      .limit(3);
    
    if (!globalError && globalKnowledge && globalKnowledge.length > 0) {
      knowledgeContext += '\n\n🌐 글로벌 지식 베이스:\n';
      knowledgeContext += globalKnowledge
        .map((k: any) => `- ${k.title}: ${k.content?.substring(0, 200)}...`)
        .join('\n');
    }

    if (searchContext) {
      knowledgeContext += '\n\n최신 웹 검색 결과:\n' + searchContext;
    }
    console.log('🔍 Knowledge context:', knowledgeContext); 
    // 채팅 히스토리 포맷
    const historyText = chatHistory
      ?.reverse()
      .map(h => `${h.role === 'user' ? '사용자' : '두더지 AI'}: ${h.content}`)
      .join('\n') || '';
    // 시스템 프롬프트 (첨부된 코드에서 가져온 전문가 설정)
    const systemPrompt = ` 사용자의 질문에 답변을 해주세요.


현재 참고 가능한 정보:
${knowledgeContext}

최근 대화 맥락:
${historyText}

답변 형식 요구사항:
- 한국어로 명확한 제목과 번호 목록 사용
- 절대 마크다운 형식 사용 금지 (별표, 해시태그, 백틱, 대시 등 일체 사용 불가)
`;

    // OpenAI API 호출
    const openaiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      max_tokens: 2500,
      temperature: 0.2,
      presence_penalty: 0.1,
      frequency_penalty: 0.1
    });

    const aiMessage = openaiResponse.choices[0].message.content || "죄송합니다. 응답을 생성할 수 없습니다.";

    // AI 응답 저장
    const { data: assistantMessage, error: assistantMessageError } = await (supabase as any)
      .from('chat_messages')
      .insert({
        canvas_id: canvasId,
        user_id: userId,
        role: 'assistant',
        content: aiMessage
      })
      .select()
      .single();

    if (assistantMessageError) {
      console.error('Error saving assistant message:', assistantMessageError);
    }

    console.log(`✅ AI response generated and saved for canvas ${canvasId}`);

    // RAG 인용 정보 생성 (NotebookLM 스타일 근거 표시)
    let knowledgeCitations: Array<{
      kind: 'knowledge';
      chunkId: string;
      knowledgeId: string;
      title: string;
      snippet: string;
      similarity: number;
    }> = [];

    if (ragSuccess && matchedChunks.length > 0) {
      // RAG 매칭된 knowledge의 제목 정보 조회
      const uniqueKnowledgeIds = Array.from(new Set(matchedChunks.map((c) => c.knowledge_id)));
      const { data: citationKnowledge } = await supabase
        .from('canvas_knowledge')
        .select('id, title')
        .in('id', uniqueKnowledgeIds);

      const knowledgeTitleMap = new Map<string, string>(
        (citationKnowledge || []).map((k: any) => [k.id, k.title]) as [string, string][]
      );

      knowledgeCitations = matchedChunks
        .slice(0, 8)
        .map((c) => ({
          kind: 'knowledge' as const,
          chunkId: c.id,
          knowledgeId: c.knowledge_id,
          title: knowledgeTitleMap.get(c.knowledge_id) || '지식 항목',
          snippet: (c.text || '').substring(0, 300),
          similarity: typeof c.similarity === 'number' ? c.similarity : 0,
        }));
    }
    const webCitations = (webResults || [])
      .slice(0, 5)
      .map((r) => ({
        kind: 'web' as const,
        title: r.title,
        url: r.link,
        source: r.source,
        snippet: r.snippet,
        relevanceScore: r.relevanceScore ?? null,
      }));

    return NextResponse.json({
      message: aiMessage,
      messageId: assistantMessage?.id,
      citations: {
        knowledge: knowledgeCitations,
        web: webCitations,
      },
      ragUsed: {
        chunksMatched: matchedChunks?.length || 0,
        webSearchUsed: !!(shouldSearch && searchContext.length > 0),
      },
    });

  } catch (error) {
    console.error('Chat API error:', error);
    
    return NextResponse.json(
      { 
        error: '채팅 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'AI Chat API for Canvas',
      usage: 'POST /api/chat/canvas with { message: string, canvasId: string }'
    },
    { status: 200 }
  );
}
