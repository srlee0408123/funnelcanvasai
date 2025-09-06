import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAuthorization } from '@/lib/auth/withAuthorization';

/**
 * shares/route.ts - Canvas per-user sharing (collection)
 * 
 * GET /api/canvases/[canvasId]/shares - 공유된 사용자 목록 조회
 * POST /api/canvases/[canvasId]/shares - 사용자 초대(공유 추가)
 */

const getShares = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId } = await params;

    const { data, error } = await (supabase as any)
      .from('canvas_shares')
      .select(`
        id,
        canvas_id,
        user_id,
        role,
        invited_by,
        created_at,
        profiles:profiles!canvas_shares_user_id_fkey (
          id,
          email,
          name,
          avatar_url
        )
      ` as any)
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching canvas shares:', error);
      return NextResponse.json({ error: '공유 목록을 불러오는데 실패했습니다.' }, { status: 500 });
    }

    const formatted = (data || []).map((row: any) => ({
      id: row.id,
      userId: row.user_id,
      role: row.role,
      createdAt: row.created_at,
      user: {
        id: row.profiles?.id,
        email: row.profiles?.email,
        firstName: row.profiles?.name?.split(' ')?.[0] || undefined,
        lastName: row.profiles?.name?.split(' ')?.slice(1).join(' ') || undefined,
        profileImageUrl: row.profiles?.avatar_url || undefined,
      }
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error('Canvas shares GET API error:', error);
    return NextResponse.json(
      { error: '공유 목록 조회 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

const postShare = async (
  request: NextRequest,
  { params, auth }: { params: any; auth: { userId: string } }
) => {
  try {
    const supabase = createServiceClient();
    const { canvasId } = await params;
    const body = await request.json();
    const email: string | undefined = body?.email;
    const role: 'editor' | 'viewer' = (body?.role === 'viewer' ? 'viewer' : 'editor');

    if (!email) {
      return NextResponse.json({ error: '이메일이 필요합니다.' }, { status: 400 });
    }

    // Find target user by email
    const { data: targetUser, error: userError } = await (supabase as any)
      .from('profiles')
      .select('id, email')
      .eq('email', email)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: '초대하려는 사용자를 찾을 수 없습니다.' }, { status: 404 });
    }

    // Upsert share (unique on canvas_id + user_id)
    const { data: shareRow, error: upsertError } = await (supabase as any)
      .from('canvas_shares')
      .upsert({
        canvas_id: canvasId,
        user_id: targetUser.id,
        role,
        invited_by: auth.userId,
      }, { onConflict: 'canvas_id,user_id' })
      .select('id, canvas_id, user_id, role, invited_by, created_at')
      .single();

    if (upsertError) {
      console.error('Error upserting canvas share:', upsertError);
      return NextResponse.json({ error: '캔버스 공유에 실패했습니다.' }, { status: 500 });
    }

    return NextResponse.json(shareRow, { status: 201 });
  } catch (error) {
    console.error('Canvas shares POST API error:', error);
    return NextResponse.json(
      { error: '캔버스 공유 생성 중 오류가 발생했습니다.', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
};

export const GET = withAuthorization({ resourceType: 'canvas' }, getShares);
export const POST = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, postShare);





