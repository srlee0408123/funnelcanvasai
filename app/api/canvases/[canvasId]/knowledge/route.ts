import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * 캔버스 지식 베이스 조회 API
 * 
 * GET /api/canvases/[canvasId]/knowledge
 * - 특정 캔버스에 업로드된 지식 자료 조회
 * - AI 채팅에서 컨텍스트로 활용
 */

interface RouteParams {
  params: {
    canvasId: string;
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = await createClient();
    const { canvasId } = await params;

    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401 }
      );
    }

    console.log(`📚 Fetching knowledge for canvas ${canvasId}, user ${user.id}`);

    // 캔버스 접근 권한 확인
    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('id, workspace_id')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas) {
      return NextResponse.json(
        { error: '캔버스를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // 워크스페이스 멤버십 확인
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', canvas.workspace_id)
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      return NextResponse.json(
        { error: '이 캔버스에 접근할 권한이 없습니다.' },
        { status: 403 }
      );
    }

    // 캔버스 지식 베이스 조회 (DB 스키마에 맞춘 컬럼 선택)
    const { data: knowledge, error: knowledgeError } = await supabase
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
      console.error('Error fetching canvas knowledge:', knowledgeError);
      return NextResponse.json(
        { error: '지식 베이스를 불러오는데 실패했습니다.' },
        { status: 500 }
      );
    }

    console.log(`✅ Retrieved ${knowledge?.length || 0} knowledge items for canvas ${canvasId}`);

    return NextResponse.json(knowledge || []);

  } catch (error) {
    console.error('Canvas knowledge API error:', error);
    
    return NextResponse.json(
      { 
        error: '지식 베이스 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
