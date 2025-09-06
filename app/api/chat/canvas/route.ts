import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { OpenAIService } from '@/services/openai';
import { CanvasRAGService } from '@/services/rag';
import { buildSystemPrompt, formatChatHistory } from '@/services/rag';

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

    // 컨텍스트 구성 (지식 + 웹)
    const { knowledgeContext, knowledgeCitations, webCitations, ragUsed } = await canvasRAG.buildContext({
      supabase,
      canvasId,
      message,
    });

    // 시스템 프롬프트 구성
    const historyText = formatChatHistory([...chatHistory].reverse());
    const systemPrompt = buildSystemPrompt(knowledgeContext, historyText);

    // OpenAI 챗 호출
    const aiMessage = await openaiService.chat(systemPrompt, message, {
      maxTokens: 2500,
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
      console.error('Error saving assistant message:', assistantMessageError);
    }


    // RAG에서 생성한 인용 정보 사용

    return NextResponse.json({
      message: aiMessage,
      messageId: assistantMessage?.id,
      citations: {
        knowledge: knowledgeCitations,
        web: webCitations,
      },
      ragUsed,
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
