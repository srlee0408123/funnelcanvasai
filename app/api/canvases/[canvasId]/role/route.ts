import { NextRequest, NextResponse } from 'next/server';
import { withAuthorization } from '@/lib/auth/withAuthorization';
import { canAccessCanvas } from '@/lib/auth/permissions';

/**
 * role/route.ts - Resolve effective role for a canvas
 * GET /api/canvases/[canvasId]/role
 */

const getRole = async (
  request: NextRequest,
  { params, auth }: { params: any; auth: { userId: string } }
) => {
  try {
    const { canvasId } = await params;
    const result = await canAccessCanvas(auth.userId, canvasId);
    if (!result.hasAccess) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }
    return NextResponse.json({ role: result.role ?? 'viewer' });
  } catch (error) {
    return NextResponse.json({ error: '역할 확인 중 오류가 발생했습니다.' }, { status: 500 });
  }
};

export const GET = withAuthorization({ resourceType: 'canvas' }, getRole);




