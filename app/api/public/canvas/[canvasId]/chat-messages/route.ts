import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * 공개 캔버스 채팅 메시지 API - 인증 없이 접근 가능
 * 
 * 주요 역할:
 * 1. 공개 캔버스의 채팅 메시지 조회
 * 2. 인증 없이 읽기 전용 접근
 * 3. 서비스 클라이언트를 통한 직접 데이터 접근
 * 
 * 핵심 특징:
 * - 공개 캔버스만 접근 가능
 * - 읽기 전용 (GET만 지원)
 * - RLS 정책 우회로 성능 최적화
 * 
 * 주의사항:
 * - 공개 캔버스 여부 필수 확인
 * - 읽기 전용으로만 제공
 * - 개인정보 노출 방지
 */

interface RouteParams {
  params: Promise<{
    canvasId: string;
  }>;
}

/**
 * 공개 캔버스 확인 함수
 * 캔버스가 공개 상태인지 검증
 */
async function checkPublicCanvas(canvasId: string) {
  const supabase = createServiceClient();
  
  // 캔버스 정보 조회
  const { data: canvas, error: canvasError } = await supabase
    .from('canvases')
    .select('id, is_public, title')
    .eq('id', canvasId)
    .single();

  if (canvasError || !canvas) {
    return { isPublic: false, error: '캔버스를 찾을 수 없습니다.' };
  }

  // 공개 캔버스 여부 확인
  if (!canvas.is_public) {
    return { isPublic: false, error: '이 캔버스는 공개되지 않았습니다.' };
  }

  return { isPublic: true, canvas };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { canvasId } = await params;
    
    // URL 파라미터 추출
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log(`📝 Fetching public chat messages for canvas ${canvasId}`);

    // 공개 캔버스 확인
    const publicCheck = await checkPublicCanvas(canvasId);
    if (!publicCheck.isPublic) {
      return NextResponse.json(
        { error: publicCheck.error },
        { status: publicCheck.error?.includes('찾을 수 없습니다') ? 404 : 403 }
      );
    }

    // 서비스 클라이언트로 채팅 메시지 조회 (RLS 우회)
    const supabase = createServiceClient();
    const { data: messages, error: messagesError } = await supabase
      .from('chat_messages')
      .select(`
        id,
        role,
        content,
        created_at
      `)
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (messagesError) {
      console.error('Error fetching public chat messages:', messagesError);
      return NextResponse.json(
        { error: '채팅 메시지를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    // 메시지 포맷팅 (개인정보 제거)
    const formattedMessages = messages?.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.created_at
      // userId는 공개 API에서 제외
    })) || [];

    console.log(`✅ Retrieved ${formattedMessages.length} public chat messages for canvas ${canvasId}`);

    return NextResponse.json(formattedMessages);

  } catch (error) {
    console.error('Public chat messages API error:', error);
    
    return NextResponse.json(
      { 
        error: '채팅 메시지 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// 공개 API에서는 POST, DELETE 등 수정 작업 불허
export async function POST() {
  return NextResponse.json(
    { error: '공개 캔버스에서는 메시지 작성이 불가능합니다.' },
    { status: 403 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    { error: '공개 캔버스에서는 메시지 삭제가 불가능합니다.' },
    { status: 403 }
  );
}
