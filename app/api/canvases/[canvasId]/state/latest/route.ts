import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

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
      .single() as { data: Database['public']['Tables']['canvases']['Row'] | null, error: any };

    if (canvasError || !canvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    }

    if (!canvas.is_public) {
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      let member = null;
      if (canvas.workspace_id) {
        const memberResult = await supabase
          .from('workspace_members')
          .select('*')
          .eq('workspace_id', canvas.workspace_id)
          .eq('user_id', userId)
          .single() as { data: Database['public']['Tables']['workspace_members']['Row'] | null, error: any };
        member = memberResult.data;
      }
      if (!member && canvas.user_id !== userId) {
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
      .single() as { data: Database['public']['Tables']['canvas_states']['Row'] | null, error: any };

    return NextResponse.json(stateRow ?? null);
  } catch (error) {
    console.error('Failed to fetch latest canvas state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


