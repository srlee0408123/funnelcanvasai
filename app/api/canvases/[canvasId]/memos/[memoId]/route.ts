import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

/**
 * memos/[memoId]/route.ts - Canvas text memo item CRUD
 * - PATCH: 메모 내용/위치/크기 업데이트
 * - DELETE: 메모 삭제
 */

interface RouteParams {
  params: Promise<{ canvasId: string; memoId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createServiceClient();
    const { canvasId, memoId } = await params;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('id, workspace_id')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas) {
      return NextResponse.json({ error: '캔버스를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', canvas.workspace_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '이 캔버스에 접근할 권한이 없습니다.' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, any> = {};
    if (typeof body?.content === 'string') updates.content = body.content;
    if (body?.position) updates.position = body.position;
    if (body?.size) updates.size = body.size;

    const { data: updated, error: updateError } = await supabase
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
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const supabase = createServiceClient();
    const { canvasId, memoId } = await params;
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('id, workspace_id')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas) {
      return NextResponse.json({ error: '캔버스를 찾을 수 없습니다.' }, { status: 404 });
    }

    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', canvas.workspace_id)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ error: '이 캔버스에 접근할 권한이 없습니다.' }, { status: 403 });
    }

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
}


