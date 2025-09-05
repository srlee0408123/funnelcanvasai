import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * 공개 캔버스 지식 베이스 조회 API - 인증 없이 접근 가능 (읽기 전용)
 */

interface RouteParams {
  params: Promise<{
    canvasId: string;
  }>;
}

async function checkPublicCanvas(canvasId: string) {
  const supabase = createServiceClient();
  const { data: canvasData, error: canvasError } = await supabase
    .from('canvases')
    .select('id, is_public, title')
    .eq('id', canvasId)
    .single();

  type CanvasPub = { id: string; is_public: boolean; title: string };
  const canvas = canvasData as CanvasPub | null;

  if (canvasError || !canvas) {
    return { isPublic: false, error: '캔버스를 찾을 수 없습니다.' };
  }
  if (!canvas.is_public) {
    return { isPublic: false, error: '이 캔버스는 공개되지 않았습니다.' };
  }
  return { isPublic: true, canvas };
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
    const { data: knowledgeData, error: knowledgeError } = await supabase
      .from('canvas_knowledge')
      .select(`
        id,
        title,
        type,
        content,
        metadata,
        created_at,
        updated_at
      `)
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: false });

    if (knowledgeError) {
      console.error('Error fetching public canvas knowledge:', knowledgeError);
      return NextResponse.json(
        { error: '지식 베이스를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    // 민감정보 노출 방지: 필요한 필드만 반환
    const items = (knowledgeData || []).map((k: any) => ({
      id: k.id,
      title: k.title,
      type: k.type,
      content: k.content,
      metadata: k.metadata,
      createdAt: k.created_at,
      updatedAt: k.updated_at,
    }));

    return NextResponse.json(items);
  } catch (error) {
    console.error('Public canvas knowledge API error:', error);
    return NextResponse.json(
      { error: '지식 베이스 조회 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  return NextResponse.json(
    { error: '공개 캔버스에서는 지식 생성이 불가능합니다.' },
    { status: 403 }
  );
}


