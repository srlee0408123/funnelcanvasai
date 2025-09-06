import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAuthorization } from '@/lib/auth/withAuthorization';
import { upsertCanvasMemosKnowledge } from '@/services/rag/localIngest';

/**
 * memos/route.ts - Canvas text memos CRUD (collection)
 * 
 * 주요 역할:
 * 1. 특정 캔버스의 메모 목록 조회 (GET)
 * 2. 메모 생성 (POST)
 * 
 * 핵심 특징:
 * - 권한 검증은 withAuthorization에서 처리
 * - Supabase를 통한 간단한 CRUD
 * - Next.js 15 규칙(params await, async client) 준수
 * 
 * 주의사항:
 * - params는 반드시 await 후 사용
 * - createClient는 async 이므로 await 필요
 * - 응답 스키마는 CanvasArea의 Memo 타입(id, content, position, size)과 호환
 */

const getMemos = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId } = await params;

    const { data: memos, error: memosError } = await supabase
      .from('text_memos')
      .select('id, content, position, size')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true });

    if (memosError) {
      console.error('Error fetching text memos:', memosError);
      return NextResponse.json({ error: '메모를 불러오는데 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json(memos || []);
  } catch (error) {
    console.error('Text memos GET API error:', error);
    return NextResponse.json(
      { error: '메모 조회 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

const postMemo = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId } = await params;

    const body = await request.json();
    const content: string = body?.content ?? '새 메모';
    const position: { x: number; y: number } = body?.position ?? { x: 0, y: 0 };
    const size: { width: number; height: number } | null = body?.size ?? null;

    const { data: inserted, error: insertError } = await (supabase as any)
      .from('text_memos')
      .insert({
        canvas_id: canvasId,
        content,
        position,
        size,
      })
      .select('id, content, position, size')
      .single();

    if (insertError) {
      console.error('Error inserting text memo:', insertError);
      return NextResponse.json({ error: '메모 생성에 실패했습니다.' }, { status: 500 });
    }

    // RAG 동기화: 메모 생성 반영
    try {
      await upsertCanvasMemosKnowledge({ supabase, canvasId });
    } catch (e) {
      console.error('RAG sync (memo create) failed:', e);
    }

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error('Text memos POST API error:', error);
    return NextResponse.json(
      { error: '메모 생성 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

export const GET = withAuthorization({ resourceType: 'canvas' }, getMemos);
export const POST = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, postMemo);
