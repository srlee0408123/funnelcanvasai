import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { OpenAIService } from '@/services/openai';
import { CanvasRAGService } from '@/services/rag';
import { ragPromptService } from '@/services/ragPromptService';
import { buildAnswerSynthesisPrompt, DEFAULT_SYSTEM_PROMPT_HEADER, buildConversationSummaryPrompt, buildKnowledgeSummaryPrompt, buildWebSearchAnswerPrompt } from '@/services/rag';
import { isFreePlan, countUserChatQuestionsToday } from '@/lib/planLimits';

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
 * 3. 마케팅 전문가 "Canvas AI" 페르소나
 * 4. 채팅 히스토리 저장
 */

const openaiService = new OpenAIService();
const canvasRAG = new CanvasRAGService(openaiService);

function isConversationSummaryRequest(message: string): boolean {
  const text = (message || '').toLowerCase();
  return /요약/.test(text) && /(대화|채팅|so far|conversation|지금까지)/i.test(message);
}

function isKnowledgeSummaryRequest(message: string): boolean {
  const text = (message || '').toLowerCase();
  return /요약/.test(text) && /(지식|자료|업로드|context|컨텍스트|knowledge)/i.test(message);
}

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


    // 무료 플랜: 하루 5개 질문 제한 (user role: user 메시지만 카운트)
    try {
      const free = await isFreePlan(userId);
      if (free) {
        const todayCount = await countUserChatQuestionsToday(userId, canvasId);
        if (todayCount >= 5) {
          return NextResponse.json({
            error: '무료 플랜에서는 AI 질문을 하루 5개까지 사용할 수 있습니다. 내일 다시 시도하시거나 Pro로 업그레이드 해주세요.',
            code: 'FREE_PLAN_CHAT_DAILY_LIMIT',
            limit: 5
          }, { status: 403 });
        }
      }
    } catch (planErr) {
      console.warn('Chat plan check failed:', planErr);
    }

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
      // 사용자 메시지 저장 실패 - 조용히 처리
    }

    // 최근 채팅 히스토리 조회 (컨텍스트용)
    const { data: chatHistoryData } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: false })
      .limit(10);
    const chatHistory = (chatHistoryData || []) as any[];

    // 컨텍스트 구성 (지식 + 웹)
    const { knowledgeContext, knowledgeCitations, webCitations, webContext, ragUsed, actionDecision } = await canvasRAG.buildContext({
      supabase,
      canvasId,
      message,
      historyText: [...chatHistory].reverse().map((h: any) => `${h.role === 'user' ? '사용자' : 'Canvas AI'}: ${h.content}`).join('\n'),
    });

    // 시스템 프롬프트 구성 및 액션 기반 의사결정 (KNOWLEDGE_ONLY / WEB_SEARCH / CLARIFY)
    const historyText = [...chatHistory].reverse().map((h: any) => `${h.role === 'user' ? '사용자' : 'Canvas AI'}: ${h.content}`).join('\n');
    // 프롬프트 타입별 외부 지시문 로드 (비어있으면 기본 헤더 사용)
    const [externalInstructionDefault, externalInstructionConv, externalInstructionKnow, externalInstructionWeb] = await Promise.all([
      ragPromptService.getActiveInstruction(),
      ragPromptService.getInstructionByName('CONVERSATION_SUMMARY_TEMPLATE'),
      ragPromptService.getInstructionByName('KNOWLEDGE_SUMMARY_TEMPLATE'),
      ragPromptService.getInstructionByName('WEB_SEARCH_ANSWER_TEMPLATE'),
    ]);
    let aiMessage = '';
    let webCitationsFinal = webCitations;

    // 0) 요약 요청 우선 처리
    if (isConversationSummaryRequest(message)) {
      // 오늘 날짜 범위 계산 (UTC 기준)
      const now = new Date();
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
      const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));

      const { data: todayChats } = await supabase
        .from('chat_messages')
        .select('role, content, created_at')
        .eq('canvas_id', canvasId)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .order('created_at', { ascending: true });

      const todayHistory = (todayChats || []) as any[];
      const todayHistoryText = todayHistory.map((h: any) => `${h.role === 'user' ? '사용자' : 'Canvas AI'}: ${h.content}`).join('\n');

      const system = buildConversationSummaryPrompt(todayHistoryText, externalInstructionConv || externalInstructionDefault);

      const aiMessage = await openaiService.chat(system, '위 대화를 5~8개의 불릿으로 요약해줘.');

      const { data: assistantMessage } = await (supabase as any)
        .from('chat_messages')
        .insert({ canvas_id: canvasId, user_id: userId, role: 'assistant', content: aiMessage })
        .select()
        .single();

      return NextResponse.json({
        message: aiMessage,
        messageId: assistantMessage?.id,
        citations: { knowledge: [], web: [] },
        ragUsed
      });
    }

    if (isKnowledgeSummaryRequest(message)) {
      // 전체 요약용 컨텍스트(번호/유사도 제거, 원문 중심) 생성 후 요약
      const fullSummaryContext = await canvasRAG.buildFullSummaryContext({
        supabase,
        canvasId,
        message,
        includeGlobal: true,
        historyText
      });

      const system = buildKnowledgeSummaryPrompt(fullSummaryContext, externalInstructionKnow || externalInstructionDefault);

      const aiMessage = await openaiService.chat(system, '위 컨텍스트 전체를 가능한 많은 내용을 포함하여 핵심만 간결히 요약해줘.', { maxTokens: 4000, temperature: 0.2 });

      const { data: assistantMessage } = await (supabase as any)
        .from('chat_messages')
        .insert({ canvas_id: canvasId, user_id: userId, role: 'assistant', content: aiMessage })
        .select()
        .single();

      return NextResponse.json({
        message: aiMessage,
        messageId: assistantMessage?.id,
        citations: { knowledge: knowledgeCitations, web: [] },
        ragUsed
      });
    }

    // CLARIFY 액션 시, 모델이 제안한 clarificationQuestion을 곧바로 응답으로 사용
    if (actionDecision?.action === 'CLARIFY') {
      const clarify = actionDecision?.clarificationQuestion || '질문을 더 구체적으로 알려주세요. 어떤 내용을 알고 싶으신가요?';
      aiMessage = clarify;

      // 저장 및 응답 반환 (웹 인용은 없음)
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
        // 조용히 처리
      }

      return NextResponse.json({
        message: aiMessage,
        messageId: assistantMessage?.id,
        citations: {
          knowledge: knowledgeCitations,
          web: [],
        },
        ragUsed,
      });
    }

    // 새로 추가된 요약 액션 처리: CONVERSATION_SUMMARY, KNOWLEDGE_SUMMARY
    if (actionDecision?.action === 'CONVERSATION_SUMMARY') {
      // 최근 히스토리를 가능한 한 많이 포함하여 요약 (maxTokens 크게)
      const system = buildConversationSummaryPrompt(historyText, externalInstructionConv || externalInstructionDefault);

      aiMessage = await openaiService.chat(system, '위 대화를 가능한 많은 내용을 포함하여 6~10개의 불릿으로 요약해줘.', { maxTokens: 4000, temperature: 0.2 });

      const { data: assistantMessage } = await (supabase as any)
        .from('chat_messages')
        .insert({ canvas_id: canvasId, user_id: userId, role: 'assistant', content: aiMessage })
        .select()
        .single();

      return NextResponse.json({
        message: aiMessage,
        messageId: assistantMessage?.id,
        citations: { knowledge: [], web: [] },
        ragUsed
      });
    }

    if (actionDecision?.action === 'KNOWLEDGE_SUMMARY') {
      // 전체 요약용 컨텍스트(번호/유사도 제거, 원문 중심) 생성 후 요약
      const fullSummaryContext = await canvasRAG.buildFullSummaryContext({
        supabase,
        canvasId,
        message,
        includeGlobal: true,
        historyText
      });

      const system = buildKnowledgeSummaryPrompt(fullSummaryContext, externalInstructionKnow || externalInstructionDefault);

      aiMessage = await openaiService.chat(system, '위 컨텍스트 전체를 가능한 많은 내용을 포함하여 핵심만 간결히 요약해줘.', { maxTokens: 4000, temperature: 0.2 });

      const { data: assistantMessage } = await (supabase as any)
        .from('chat_messages')
        .insert({ canvas_id: canvasId, user_id: userId, role: 'assistant', content: aiMessage })
        .select()
        .single();

      return NextResponse.json({
        message: aiMessage,
        messageId: assistantMessage?.id,
        citations: { knowledge: knowledgeCitations, web: [] },
        ragUsed
      });
    }

    // 새 캔버스RAG 로직은 내부에서 buildOptimalActionDecisionPrompt를 사용하여 액션을 결정합니다
    // 1) CLARIFY는 위에서 처리
    // 2) WEB_SEARCH는 Perplexity로 searchQuery를 사용자 프롬프트로 사용해 답변을 생성
    if (actionDecision?.action === 'WEB_SEARCH') {
      const query = actionDecision.searchQuery && actionDecision.searchQuery.trim().length > 0
        ? actionDecision.searchQuery
        : message;
      const systemForPplx = buildWebSearchAnswerPrompt(externalInstructionWeb || externalInstructionDefault);
      try {
        const { content, citations } = await canvasRAG.answerWithPerplexity(systemForPplx, query, { maxTokens: 4000, temperature: 0.2 });
        aiMessage = content;
        // Perplexity 인용을 our WebCitation 포맷으로 매핑
        webCitationsFinal = (citations || []).slice(0, 5).map((url) => ({
          kind: 'web' as const,
          title: '출처',
          url: String(url),
          source: undefined,
          snippet: '',
          relevanceScore: null,
        }));

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
          // 조용히 처리
        }

        return NextResponse.json({
          message: aiMessage,
          messageId: assistantMessage?.id,
          citations: {
            knowledge: knowledgeCitations,
            web: webCitationsFinal,
          },
          ragUsed,
        });
      } catch (err) {
        // Perplexity 실패 시 기존 경로로 폴백 (지식+웹 합성 후 OpenAI)
      }
    }

    // 우선 내부 maybeSearchWeb이 액션에 따라 검색을 수행하므로, 여기서는 knowledgeContext + (검색 결과)로 합성하여 답변을 생성합니다
    const mergedContext = knowledgeContext + (webContext ? `\n\n[웹 검색 결과]\n${webContext}` : '');
    const systemPrompt = buildAnswerSynthesisPrompt(mergedContext, historyText, message, externalInstructionDefault ?? DEFAULT_SYSTEM_PROMPT_HEADER);
    aiMessage = await openaiService.chat(systemPrompt, message, {
      maxTokens: 4000,
      temperature: 0.2,
      presencePenalty: 0.1,
      frequencyPenalty: 0.1,
    });

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
      // AI 응답 저장 실패 - 조용히 처리
    }


    // RAG에서 생성한 인용 정보 사용

    return NextResponse.json({
      message: aiMessage,
      messageId: assistantMessage?.id,
      citations: {
        knowledge: knowledgeCitations,
        web: webCitationsFinal,
      },
      ragUsed,
    });

  } catch (error) {
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
