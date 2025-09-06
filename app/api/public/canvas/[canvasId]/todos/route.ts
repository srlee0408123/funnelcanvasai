import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getCanvasAccessInfo } from '@/lib/auth/auth-service';

/**
 * 공개 캔버스 할일 목록 조회 API - 인증 없이 접근 가능 (읽기 전용)
 */

interface RouteParams {
  params: Promise<{
    canvasId: string;
  }>;
}

async function checkPublicCanvas(canvasId: string) {
  const access = await getCanvasAccessInfo(null, canvasId);
  if (!access.hasAccess || access.role !== 'viewer') {
    return { isPublic: false, error: '이 캔버스는 공개되지 않았습니다.' };
  }
  return { isPublic: true } as const;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { canvasId } = await params;

    // 공개 캔버스 확인
    const publicCheck = await checkPublicCanvas(canvasId);
    if (!publicCheck.isPublic) {
      return NextResponse.json(
        { error: publicCheck.error },
        { status: publicCheck.error?.includes('찾을 수 없습니다') ? 404 : 403 }
      );
    }

    const supabase = createServiceClient();
    const { data: todosData, error: todosError } = await supabase
      .from('canvas_todos')
      .select(`
        id,
        text,
        completed,
        position,
        created_at,
        updated_at
      `)
      .eq('canvas_id', canvasId)
      .order('position', { ascending: true });

    if (todosError) {
      console.error('Error fetching public canvas todos:', todosError);
      return NextResponse.json(
        { error: '할일 목록을 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    const items = (todosData || []).map((t: any) => ({
      id: t.id,
      text: t.text,
      completed: t.completed,
      position: t.position,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Public canvas todos API error:', error);
    return NextResponse.json(
      { error: '할일 목록 조회 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: '공개 캔버스에서는 할일 생성이 불가능합니다.' },
    { status: 403 }
  );
}


