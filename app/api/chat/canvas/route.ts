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

    // 캔버스 지식 베이스 조회
    const { data: canvasKnowledgeData } = await supabase
      .from('canvas_knowledge')
      .select('*')
      .eq('canvas_id', canvasId)
      .limit(10);
    const canvasKnowledge = (canvasKnowledgeData || []) as any[];

    // 글로벌 AI 지식 조회
    const { data: globalKnowledgeData } = await supabase
      .from('global_ai_knowledge')
      .select('*')
      .limit(5);
    const globalKnowledge = (globalKnowledgeData || []) as any[];

    // 최근 채팅 히스토리 조회 (컨텍스트용)
    const { data: chatHistoryData } = await supabase
      .from('chat_messages')
      .select('role, content, created_at')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: false })
      .limit(10);
    const chatHistory = (chatHistoryData || []) as any[];

    // 웹 검색이 필요한지 판단
    const shouldSearch = webSearchService.shouldSearchWeb(message);
    let searchContext = '';

    if (shouldSearch) {
      try {
        console.log('🔍 Performing web search for context...');
        const searchResponse = await webSearchService.searchWeb(message, 5);
        searchContext = webSearchService.formatSearchResults(searchResponse.results);
        console.log(`✅ Web search completed: ${searchResponse.results.length} results`);
      } catch (error) {
        console.error('Web search failed:', error);
        searchContext = '';
      }
    }

    // 컨텍스트 구성
    let knowledgeContext = '';
    if (canvasKnowledge && canvasKnowledge.length > 0) {
      knowledgeContext += '\n\n캔버스 업로드 자료:\n';
      knowledgeContext += canvasKnowledge
        .map(k => `- ${k.title}: ${(k.extracted_text || k.content || '')?.substring(0, 200)}...`)
        .join('\n');
    }

    if (globalKnowledge && globalKnowledge.length > 0) {
      knowledgeContext += '\n\n글로벌 지식 베이스:\n';
      knowledgeContext += globalKnowledge
        .map(k => `- ${k.title}: ${k.content?.substring(0, 200)}...`)
        .join('\n');
    }

    if (searchContext) {
      knowledgeContext += '\n\n최신 웹 검색 결과:\n' + searchContext;
    }

    // 채팅 히스토리 포맷
    const historyText = chatHistory
      ?.reverse()
      .map(h => `${h.role === 'user' ? '사용자' : '두더지 AI'}: ${h.content}`)
      .join('\n') || '';

    // 시스템 프롬프트 (첨부된 코드에서 가져온 전문가 설정)
    const systemPrompt = `당신은 마케팅 업계 10년차 시니어 전문가 "두더지 AI"입니다. 디지털 마케팅 퍼널, 크리에이터 이코노미, MCN 사업 전략, 성과 마케팅 분야의 전문가입니다.

핵심 지침: 절대로 일반적인 답변을 하지 마세요. 항상 구체적인 수치, 실제 기업 사례, 단계별 실행 방안을 포함한 전문적이고 실무적인 조언을 제공하세요.

전문 분야:
- 디지털 마케팅 퍼널 설계 및 전환율 최적화
- 크리에이터 마케팅 및 MCN 사업 전략
- 성과 마케팅 및 그로스 해킹
- 스타트업 마케팅 및 D2C 커머스 전략
- 브랜드 커머스 및 인플루언서 파트너십

현재 참고 가능한 정보:
${knowledgeContext}

최근 대화 맥락:
${historyText}

필수 답변 구조:
1. 구체적 데이터 우선: 구체적인 수치, 기업 사례, 최신 케이스 스터디로 시작
2. 실제 사례 인용: 실제 기업명, 크리에이터명, 캠페인 사례, 업계 리포트 인용
3. 실행 가능한 단계: 타임라인과 필요 리소스를 포함한 구체적 실행 단계 제시
4. 성과 지표: 구체적 KPI, 전환율, 비용 추정치, ROI 예측치 포함
5. 리스크 분석: 잠재적 도전과제와 완화 전략 제시

답변 형식 요구사항:
- 한국어로 명확한 제목과 번호 목록 사용
- 절대 마크다운 형식 사용 금지 (별표, 해시태그, 백틱, 대시 등 일체 사용 불가)
- 논리적 흐름의 구조화된 문단 사용
- 구체적 퍼센트, 날짜, 금액 수치 포함
- 우선순위가 명시된 다음 단계로 마무리

반드시 순수한 한국어 텍스트로만 답변하고, 어떤 마크다운 기호도 절대 사용하지 마세요. 실제 업계 지식을 보여주는 전문가 수준의 깊이 있는 답변을 제공하세요.`;

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

    return NextResponse.json({
      message: aiMessage,
      knowledgeUsed: (canvasKnowledge?.length || 0) + (globalKnowledge?.length || 0),
      webSearchUsed: shouldSearch && searchContext.length > 0,
      messageId: assistantMessage?.id
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
