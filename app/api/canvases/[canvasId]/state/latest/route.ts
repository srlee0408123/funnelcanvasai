import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

interface RouteParams {
  params: Promise<{
    canvasId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { canvasId } = await params;
    const supabase = await createClient();

    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    }

    if (!canvas.is_public) {
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      const { data: member } = await supabase
        .from('workspace_members')
        .select('*')
        .eq('workspace_id', canvas.workspace_id)
        .eq('user_id', userId)
        .single();
      if (!member && canvas.created_by !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Latest state only
    const { data: stateRow } = await supabase
      .from('canvas_states')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json(stateRow ?? null);
  } catch (error) {
    console.error('Failed to fetch latest canvas state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


