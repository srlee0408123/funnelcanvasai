import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAuthorization } from '@/lib/auth/withAuthorization';
import { upsertCanvasMemosKnowledge } from '@/services/rag/localIngest';

/**
 * memos/[memoId]/route.ts - Canvas text memo item CRUD
 * - PATCH: 메모 내용/위치/크기 업데이트
 * - DELETE: 메모 삭제
 */

const patchMemo = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId, memoId } = await params;

    const body = await request.json();
    const updates: Record<string, any> = {};
    if (typeof body?.content === 'string') updates.content = body.content;
    if (body?.position) updates.position = body.position;
    if (body?.size) updates.size = body.size;

    const { data: updated, error: updateError } = await (supabase as any)
      .from('text_memos')
      .update(updates)
      .eq('id', memoId)
      .eq('canvas_id', canvasId)
      .select('id, content, position, size')
      .maybeSingle();

    if (updateError) {
      console.error('Error updating text memo:', updateError);
      return NextResponse.json({ error: '메모 업데이트에 실패했습니다.' }, { status: 500 });
    }

    // 0행 업데이트(이미 삭제되었거나 없는 경우) - 404로 응답
    if (!updated) {
      return NextResponse.json(
        { error: '해당 메모를 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    // RAG 동기화: 메모 업데이트 반영
    try {
      await upsertCanvasMemosKnowledge({ supabase, canvasId });
    } catch (e) {
      console.error('RAG sync (memo update) failed:', e);
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Text memo PATCH API error:', error);
    return NextResponse.json(
      { error: '메모 업데이트 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

const deleteMemo = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId, memoId } = await params;

    const { error: deleteError } = await supabase
      .from('text_memos')
      .delete()
      .eq('id', memoId)
      .eq('canvas_id', canvasId);

    if (deleteError) {
      console.error('Error deleting text memo:', deleteError);
      return NextResponse.json({ error: '메모 삭제에 실패했습니다.' }, { status: 500 });
    }

    // RAG 동기화: 메모 삭제 반영
    try {
      await upsertCanvasMemosKnowledge({ supabase, canvasId });
    } catch (e) {
      console.error('RAG sync (memo delete) failed:', e);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Text memo DELETE API error:', error);
    return NextResponse.json(
      { error: '메모 삭제 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

export const PATCH = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, patchMemo);
export const DELETE = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, deleteMemo);
