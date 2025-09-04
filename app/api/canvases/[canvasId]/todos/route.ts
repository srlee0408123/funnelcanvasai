import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireCanvasAccess } from '@/lib/canvasPermissions';

/**
 * 캔버스 할일 목록 관리 API
 * 
 * GET /api/canvases/[canvasId]/todos - 할일 목록 조회
 * POST /api/canvases/[canvasId]/todos - 할일 생성
 * - AI 채팅에서 컨텍스트로 활용
 */

interface RouteParams {
  params: {
    canvasId: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { canvasId } = await params;

    console.log(`📋 Fetching todos for canvas ${canvasId}, user ${userId}`);

    // 권한 검사 (인증 + 캔버스 접근 권한)
    const permissionCheck = await requireCanvasAccess(canvasId, userId);
    if (!permissionCheck.success) {
      return permissionCheck.response;
    }

    const supabase = createServiceClient();

    // 할일 목록 조회
    const { data: todos, error: todosError } = await supabase
      .from('canvas_todos')
      .select(`
        id,
        canvas_id,
        text,
        completed,
        position,
        created_at,
        updated_at
      `)
      .eq('canvas_id', canvasId)
      .order('position', { ascending: true });

    if (todosError) {
      console.error('Error fetching canvas todos:', todosError);
      return NextResponse.json(
        { error: '할일 목록을 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log(`✅ Retrieved ${todos?.length || 0} todos for canvas ${canvasId}`);

    return NextResponse.json(todos || []);

  } catch (error) {
    console.error('Canvas todos API error:', error);
    
    return NextResponse.json(
      { 
        error: '할일 목록 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { canvasId } = await params;
    const body = await request.json();

    console.log(`📋 Creating todo for canvas ${canvasId}, user ${userId}`);

    // 권한 검사 (인증 + 캔버스 접근 권한)
    const permissionCheck = await requireCanvasAccess(canvasId, userId);
    if (!permissionCheck.success) {
      return permissionCheck.response;
    }

    const supabase = createServiceClient();

    // 다음 position 값 계산
    const { data: lastTodo } = await supabase
      .from('canvas_todos')
      .select('position')
      .eq('canvas_id', canvasId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (lastTodo?.position || 0) + 1;

    // 할일 생성
    const { data: newTodo, error: createError } = await supabase
      .from('canvas_todos')
      .insert({
        canvas_id: canvasId,
        text: body.text,
        completed: false,
        position: nextPosition
      })
      .select(`
        id,
        canvas_id,
        text,
        completed,
        position,
        created_at,
        updated_at
      `)
      .single();

    if (createError) {
      console.error('Error creating canvas todo:', createError);
      return NextResponse.json(
        { error: '할일을 생성하는데 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log(`✅ Created todo ${newTodo.id} for canvas ${canvasId}`);

    return NextResponse.json(newTodo);

  } catch (error) {
    console.error('Canvas todo creation API error:', error);
    
    return NextResponse.json(
      { 
        error: '할일 생성 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}