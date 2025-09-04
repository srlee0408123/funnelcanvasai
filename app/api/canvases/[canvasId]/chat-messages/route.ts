import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAuthorization } from '@/lib/auth/withAuthorization';

/**
 * 캔버스 채팅 메시지 API - 중앙 권한 레이어(HOF) 적용
 * 
 * 주요 역할:
 * 1. 권한 검증은 withAuthorization에서 처리
 * 2. GET/POST/DELETE는 순수 비즈니스 로직에 집중
 * 3. 서비스 클라이언트를 통한 직접 데이터 접근(RLS 우회)
 * 
 * 핵심 특징:
 * - 선언형 권한 설정(minRole)으로 실수 방지
 * - 공통 에러/권한 처리의 중앙화
 * - 유지보수성/가독성 향상
 * 
 * 주의사항:
 * - params는 Next.js 15에서 Promise일 수 있어 await 사용 가능
 * - POST/DELETE는 멤버 이상으로 제한(minRole: 'member')
 */

// Supabase chat_messages 테이블의 선택 컬럼 타입
type ChatMessageRow = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  user_id: string;
};
const getChatMessages = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId } = await params;

    // URL 파라미터 추출
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('id, role, content, created_at, user_id')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching chat messages:', error);
      return NextResponse.json({ error: '채팅 메시지를 불러오는데 실패했습니다.' }, { status: 500 });
    }

    const rows = (messages ?? []) as ChatMessageRow[];
    const formatted = rows.map((msg) => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.created_at,
      userId: msg.user_id,
    }));

    return NextResponse.json(formatted);
  } catch (e) {
    console.error('Chat messages GET error:', e);
    return NextResponse.json(
      { error: '채팅 메시지 조회 중 오류가 발생했습니다.', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

const postChatMessage = async (
  request: NextRequest,
  { params, auth }: { params: any; auth: { userId: string } }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId } = await params;
    const body = await request.json();
    const { role, content } = body;

    if (!role || !content || !['user', 'assistant'].includes(role)) {
      return NextResponse.json({ error: '올바른 role(user/assistant)과 content가 필요합니다.' }, { status: 400 });
    }

    const { data: message, error: insertError } = await (supabase as any)
      .from('chat_messages')
      .insert([
        {
          canvas_id: canvasId,
          user_id: auth.userId,
          role,
          content,
        },
      ])
      .select('id, role, content, created_at, user_id')
      .single();

    if (insertError) {
      console.error('Error creating chat message:', insertError);
      return NextResponse.json({ error: '메시지 생성에 실패했습니다.' }, { status: 500 });
    }

    const created = message as unknown as ChatMessageRow;
    const formatted = {
      id: created.id,
      role: created.role,
      content: created.content,
      createdAt: created.created_at,
      userId: created.user_id,
    };

    return NextResponse.json(formatted);
  } catch (e) {
    console.error('Chat messages POST error:', e);
    return NextResponse.json(
      { error: '메시지 생성 중 오류가 발생했습니다.', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

const deleteChatMessage = async (
  request: NextRequest,
  { params, auth }: { params: any; auth: { userId: string } }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId } = await params;
    const body = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json({ error: '메시지 ID가 필요합니다.' }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId)
      .eq('canvas_id', canvasId)
      .eq('user_id', auth.userId);

    if (deleteError) {
      console.error('Error deleting chat message:', deleteError);
      return NextResponse.json({ error: '메시지 삭제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Chat messages DELETE error:', e);
    return NextResponse.json(
      { error: '메시지 삭제 중 오류가 발생했습니다.', details: e instanceof Error ? e.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

export const GET = withAuthorization({ resourceType: 'canvas' }, getChatMessages);
export const POST = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, postChatMessage);
export const DELETE = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, deleteChatMessage);