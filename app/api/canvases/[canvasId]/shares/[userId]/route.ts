import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAuthorization } from '@/lib/auth/withAuthorization';

/**
 * shares/[userId]/route.ts - Single share operations
 * 
 * PATCH /api/canvases/[canvasId]/shares/[userId]  - Update role
 * DELETE /api/canvases/[canvasId]/shares/[userId] - Remove share
 */

const patchShare = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId, userId } = await params;
    const body = await request.json();
    const role: 'editor' | 'viewer' | undefined = body?.role;

    if (!role || !['editor', 'viewer'].includes(role)) {
      return NextResponse.json({ error: 'role은 editor 또는 viewer여야 합니다.' }, { status: 400 });
    }

    const { data, error } = await (supabase as any)
      .from('canvas_shares')
      .update({ role })
      .eq('canvas_id', canvasId)
      .eq('user_id', userId)
      .select('id, canvas_id, user_id, role, invited_by, created_at')
      .single();

    if (error) {
      console.error('Error updating canvas share role:', error);
      return NextResponse.json({ error: '공유 역할 변경에 실패했습니다.' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: '공유 레코드를 찾을 수 없습니다.' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Canvas share PATCH API error:', error);
    return NextResponse.json(
      { error: '공유 역할 변경 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

const deleteShare = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId, userId } = await params;

    const { error } = await (supabase as any)
      .from('canvas_shares')
      .delete()
      .eq('canvas_id', canvasId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error removing canvas share:', error);
      return NextResponse.json({ error: '공유 해제에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Canvas share DELETE API error:', error);
    return NextResponse.json(
      { error: '공유 해제 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

export const PATCH = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, patchShare);
export const DELETE = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, deleteShare);




