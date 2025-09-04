import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAuthorization } from '@/lib/auth/withAuthorization';

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
      .single();

    if (updateError) {
      console.error('Error updating text memo:', updateError);
      return NextResponse.json({ error: '메모 업데이트에 실패했습니다.' }, { status: 500 });
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
