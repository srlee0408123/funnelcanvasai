import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';
import type { Database } from '@/lib/database.types';

/**
 * state/route.ts - Save/read canvas state (collection endpoint)
 * - POST: Save a new state snapshot for the canvas
 * - GET:  Fetch the latest state snapshot
 */

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

    // Load canvas and workspace to check access
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

    // Return latest state
    const { data: stateRow } = await supabase
      .from('canvas_states')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single() as { data: Database['public']['Tables']['canvas_states']['Row'] | null, error: any };

    return NextResponse.json(stateRow ?? null);
  } catch (error) {
    console.error('Failed to fetch canvas state:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { canvasId } = await params;
    const body = await request.json();
    const supabase = await createClient();

    // Check access
    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .single() as { data: Database['public']['Tables']['canvases']['Row'] | null, error: any };

    if (canvasError || !canvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
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

    // Accept either flowJson (new) or state (legacy) in request body
    const statePayload = body?.flowJson ?? body?.state;
    if (typeof statePayload === 'undefined') {
      return NextResponse.json({ error: 'Missing flowJson in body' }, { status: 400 });
    }

    const insertPayload: Database['public']['Tables']['canvas_states']['Insert'] = {
      canvas_id: canvasId,
      version: 1, // 임시로 버전 1로 설정
      flow_json: statePayload,
      flow_hash: null,
    };

    const { data: inserted, error: insertError } = await supabase
      .from('canvas_states')
      .insert(insertPayload as any)
      .select('*')
      .single();

    if (insertError) {
      console.error('Failed to save canvas state:', insertError);
      return NextResponse.json({ error: 'Failed to save canvas state' }, { status: 500 });
    }

    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error('Canvas state POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


