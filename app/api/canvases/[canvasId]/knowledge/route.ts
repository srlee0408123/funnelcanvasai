import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAuthorization } from '@/lib/auth/withAuthorization';

/**
 * 캔버스 지식 베이스 조회 API
 * 
 * GET /api/canvases/[canvasId]/knowledge
 * - 특정 캔버스에 업로드된 지식 자료 조회
 * - AI 채팅에서 컨텍스트로 활용
 */

const getKnowledge = async (
  request: NextRequest,
  { params, auth }: { params: any; auth: { userId: string } }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId } = await params;


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

    const res = NextResponse.json(knowledge || []);
    // 지식은 상대적으로 정적: 강한 캐싱 + SWR로 효율적 폴링
    res.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=300');
    return res;

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
};

export const GET = withAuthorization({ resourceType: 'canvas' }, getKnowledge);
