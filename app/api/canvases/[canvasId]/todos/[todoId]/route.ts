import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAuthorization } from '@/lib/auth/withAuthorization';

/**
 * 개별 할일 관리 API
 * 
 * PATCH /api/canvases/[canvasId]/todos/[todoId] - 할일 수정
 * DELETE /api/canvases/[canvasId]/todos/[todoId] - 할일 삭제
 */

const patchTodo = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const { canvasId, todoId } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    const updateData: any = {};
    if (body.text !== undefined) updateData.text = body.text;
    if (body.completed !== undefined) updateData.completed = body.completed;
    if (body.position !== undefined) updateData.position = body.position;

    const { data: updatedTodo, error: updateError } = await (supabase as any)
      .from('canvas_todos')
      .update(updateData)
      .eq('id', todoId)
      .eq('canvas_id', canvasId)
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

    if (updateError) {
      console.error('Error updating canvas todo:', updateError);
      return NextResponse.json(
        { error: '할일을 수정하는데 실패했습니다.' },
        { status: 500 }
      );
    }

    if (!updatedTodo) {
      return NextResponse.json(
        { error: '할일을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedTodo);

  } catch (error) {
    console.error('Canvas todo update API error:', error);
    return NextResponse.json(
      { error: '할일 수정 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

const deleteTodo = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const { canvasId, todoId } = await params;
    const supabase = createServiceClient();

    const { error: deleteError } = await supabase
      .from('canvas_todos')
      .delete()
      .eq('id', todoId)
      .eq('canvas_id', canvasId);

    if (deleteError) {
      console.error('Error deleting canvas todo:', deleteError);
      return NextResponse.json(
        { error: '할일을 삭제하는데 실패했습니다.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Canvas todo delete API error:', error);
    return NextResponse.json(
      { error: '할일 삭제 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

export const PATCH = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, patchTodo);
export const DELETE = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, deleteTodo);
