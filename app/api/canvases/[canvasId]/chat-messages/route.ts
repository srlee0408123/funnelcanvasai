import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * 캔버스 채팅 메시지 API - RLS 우회하여 API 레벨에서 권한 검증
 * 
 * 주요 역할:
 * 1. Clerk 인증을 통한 사용자 확인
 * 2. 워크스페이스 멤버십 기반 권한 검증
 * 3. 서비스 클라이언트를 통한 직접 데이터 접근
 * 
 * 핵심 특징:
 * - RLS 정책 우회로 성능 최적화
 * - API 레벨에서 세밀한 권한 제어
 * - Clerk와 Supabase 통합 인증
 * 
 * 주의사항:
 * - 모든 권한 검증을 API에서 직접 수행
 * - 서비스 클라이언트 사용으로 보안 주의 필요
 * - 워크스페이스 멤버십 필수 확인
 */

interface RouteParams {
  params: Promise<{
    canvasId: string;
  }>;
}

/**
 * 워크스페이스 멤버십 확인 함수
 * 사용자가 해당 캔버스의 워크스페이스 멤버인지 검증
 */
async function checkWorkspaceMembership(userId: string, canvasId: string) {
  const supabase = createServiceClient();
  
  // 캔버스 정보 조회
  const { data: canvas, error: canvasError } = await supabase
    .from('canvases')
    .select('workspace_id, created_by, is_public')
    .eq('id', canvasId)
    .single();

  if (canvasError || !canvas) {
    return { hasAccess: false, error: '캔버스를 찾을 수 없습니다.' };
  }

  // 공개 캔버스인 경우 접근 허용
  if (canvas.is_public) {
    return { hasAccess: true, canvas };
  }

  // 캔버스 생성자인 경우 접근 허용
  if (canvas.created_by === userId) {
    return { hasAccess: true, canvas };
  }

  // 워크스페이스 멤버십 확인
  const { data: membership, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', canvas.workspace_id)
    .eq('user_id', userId)
    .single();

  if (memberError || !membership) {
    return { hasAccess: false, error: '이 캔버스에 접근할 권한이 없습니다.' };
  }

  return { hasAccess: true, canvas, membership };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    // Clerk 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { canvasId } = await params;
    
    // URL 파라미터 추출
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    console.log(`📝 Fetching chat messages for canvas ${canvasId}, user ${userId}`);

    // 워크스페이스 멤버십 및 접근 권한 확인
    const accessCheck = await checkWorkspaceMembership(userId, canvasId);
    if (!accessCheck.hasAccess) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.error?.includes('찾을 수 없습니다') ? 404 : 403 }
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
        created_at,
        user_id
      `)
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true })
      .range(offset, offset + limit - 1);

    if (messagesError) {
      console.error('Error fetching chat messages:', messagesError);
      return NextResponse.json(
        { error: '채팅 메시지를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    // 메시지 포맷팅
    const formattedMessages = messages?.map(msg => ({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.created_at,
      userId: msg.user_id
    })) || [];

    console.log(`✅ Retrieved ${formattedMessages.length} chat messages for canvas ${canvasId}`);

    return NextResponse.json(formattedMessages);

  } catch (error) {
    console.error('Chat messages API error:', error);
    
    return NextResponse.json(
      { 
        error: '채팅 메시지 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 채팅 메시지 삭제 API
 * 본인이 작성한 메시지만 삭제 가능
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    // Clerk 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { canvasId } = await params;
    const body = await request.json();
    const { messageId } = body;

    if (!messageId) {
      return NextResponse.json(
        { error: '메시지 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`🗑️ Deleting chat message ${messageId} for canvas ${canvasId}, user ${userId}`);

    // 워크스페이스 멤버십 및 접근 권한 확인
    const accessCheck = await checkWorkspaceMembership(userId, canvasId);
    if (!accessCheck.hasAccess) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.error?.includes('찾을 수 없습니다') ? 404 : 403 }
      );
    }

    // 서비스 클라이언트로 메시지 삭제 (본인 메시지만)
    const supabase = createServiceClient();
    const { error: deleteError } = await supabase
      .from('chat_messages')
      .delete()
      .eq('id', messageId)
      .eq('canvas_id', canvasId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('Error deleting chat message:', deleteError);
      return NextResponse.json(
        { error: '메시지 삭제에 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log(`✅ Successfully deleted chat message ${messageId}`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Delete chat message API error:', error);
    
    return NextResponse.json(
      { 
        error: '메시지 삭제 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * 채팅 메시지 생성 API
 * 새로운 채팅 메시지를 생성합니다
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    // Clerk 인증 확인
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    const { canvasId } = await params;
    const body = await request.json();
    const { role, content } = body;

    // 입력값 검증
    if (!role || !content || !['user', 'assistant'].includes(role)) {
      return NextResponse.json(
        { error: '올바른 role(user/assistant)과 content가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`💬 Creating chat message for canvas ${canvasId}, user ${userId}, role: ${role}`);

    // 워크스페이스 멤버십 및 접근 권한 확인
    const accessCheck = await checkWorkspaceMembership(userId, canvasId);
    if (!accessCheck.hasAccess) {
      return NextResponse.json(
        { error: accessCheck.error },
        { status: accessCheck.error?.includes('찾을 수 없습니다') ? 404 : 403 }
      );
    }

    // 서비스 클라이언트로 메시지 생성
    const supabase = createServiceClient();
    const { data: message, error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        canvas_id: canvasId,
        user_id: userId,
        role,
        content
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating chat message:', insertError);
      return NextResponse.json(
        { error: '메시지 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    // 메시지 포맷팅
    const formattedMessage = {
      id: message.id,
      role: message.role,
      content: message.content,
      createdAt: message.created_at,
      userId: message.user_id
    };

    console.log(`✅ Successfully created chat message ${message.id}`);
    return NextResponse.json(formattedMessage);

  } catch (error) {
    console.error('Create chat message API error:', error);
    
    return NextResponse.json(
      { 
        error: '메시지 생성 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
