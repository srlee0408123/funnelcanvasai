import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAuthorization } from '@/lib/auth/withAuthorization';
import { upsertCanvasTodosKnowledge } from '@/services/rag/localIngest';
import { getCanvasItemCounts, isFreePlan } from '@/lib/planLimits';

/**
 * 캔버스 할일 목록 관리 API
 * 
 * GET /api/canvases/[canvasId]/todos - 할일 목록 조회
 * POST /api/canvases/[canvasId]/todos - 할일 생성
 * - AI 채팅에서 컨텍스트로 활용
 */

const getTodos = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const { canvasId } = await params;
    const supabase = createServiceClient();

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

    const res = NextResponse.json(todos || []);
    // 할일 목록도 비교적 정적: 캐싱 + SWR 적용
    res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=180');
    return res;

  } catch (error) {
    console.error('Canvas todos GET API error:', error);
    return NextResponse.json(
      { error: '할일 목록 조회 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

const postTodo = async (
  request: NextRequest,
  { params, auth }: { params: any; auth: { userId: string } }
) => {
  try {
    const { canvasId } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    // 무료 플랜: 노드+메모+할일 합 10개 제한 (할일 추가 전 검사)
    try {
      const free = await isFreePlan(auth.userId);
      if (free) {
        const { total } = await getCanvasItemCounts(canvasId);
        if (total >= 10) {
          return NextResponse.json(
            { error: '무료 플랜에서는 노드+메모+할일 합계가 10개를 초과할 수 없습니다.', code: 'FREE_PLAN_LIMIT_ITEMS', limit: 10, details: { total } },
            { status: 403 }
          );
        }
      }
    } catch (e) {
      console.warn('Todo limit pre-check failed:', e);
    }

    const { data: lastTodoData } = await supabase
      .from('canvas_todos')
      .select('position')
      .eq('canvas_id', canvasId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    type TodoPos = { position: number };
    const lastTodo = lastTodoData as TodoPos | null;
    const nextPosition = ((lastTodo?.position as number) || 0) + 1;

    const { data: newTodo, error: createError } = await (supabase as any)
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

    // RAG 동기화: 할일 생성 반영
    try {
      await upsertCanvasTodosKnowledge({ supabase, canvasId });
    } catch (e) {
      console.error('RAG sync (todo create) failed:', e);
    }

    return NextResponse.json(newTodo);

  } catch (error) {
    console.error('Canvas todo POST API error:', error);
    return NextResponse.json(
      { error: '할일 생성 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

export const GET = withAuthorization({ resourceType: 'canvas' }, getTodos);
export const POST = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, postTodo);
