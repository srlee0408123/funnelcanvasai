import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { OpenAIService } from '@/services/openai';
import { CanvasRAGService } from '@/services/rag';
import { ragPromptService } from '@/services/ragPromptService';
import { buildSystemPrompt } from '@/services/rag';
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
    const { knowledgeContext, knowledgeCitations, webCitations, webContext, ragUsed } = await canvasRAG.buildContext({
      supabase,
      canvasId,
      message,
    });

    // 시스템 프롬프트 구성 및 이중 단계 의사결정 (KB 우선 / KB+웹)
    const historyText = [...chatHistory].reverse().map((h: any) => `${h.role === 'user' ? '사용자' : 'Canvas AI'}: ${h.content}`).join('\n');
    // 관리자 설정 외부 지시문(프롬프트) 로드 - 비어있으면 기본만 사용
    const externalInstruction = await ragPromptService.getActiveInstruction();
    let aiMessage = '';
    let webCitationsFinal = webCitations;

    // KB만으로 충분한지 판정
    const kbEnough = await canvasRAG.decideUseKnowledgeFirst(knowledgeContext, message);

    if (kbEnough) {
      aiMessage = await canvasRAG.answerFromKnowledgeOnly({ knowledgeContext, historyText, message, externalInstruction });
    } else {
      const result = await canvasRAG.answerFromKnowledgeAndWeb({ knowledgeContext, historyText, message, webCitations, webContext, externalInstruction });
      aiMessage = result.content;
      webCitationsFinal = result.webCitations;
    }

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
