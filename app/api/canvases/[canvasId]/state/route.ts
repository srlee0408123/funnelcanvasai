import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { Database } from '@/lib/database.types';
import { getCanvasAccessInfo } from '@/lib/auth/auth-service';
import { getLatestCanvasState, insertCanvasState, getCanvasById } from '@/services/canvas-service';
import { createServiceClient } from '@/lib/supabase/service';
// RAG 동기화는 상태 저장과 분리하여 업로드 시로 제한

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
    const canvas = await getCanvasById(canvasId);
    if (!canvas) return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });

    const access = await getCanvasAccessInfo(userId ?? null, canvasId);
    if (!access.hasAccess) {
      return NextResponse.json({ error: userId ? 'Forbidden' : 'Unauthorized' }, { status: userId ? 403 : 401 });
    }

    const stateRow = await getLatestCanvasState(canvasId);
    const res = NextResponse.json(stateRow ?? null);
    // 상태는 자주 변할 수 있으므로 강한 캐싱은 피하지만, 동일 요청에 대한 짧은 캐싱을 허용
    res.headers.set('Cache-Control', 'private, max-age=5, stale-while-revalidate=30');
    return res;
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
    const canvas = await getCanvasById(canvasId);
    if (!canvas) return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    const access = await getCanvasAccessInfo(userId, canvasId);
    if (!access.hasAccess || access.role === 'viewer') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Accept either flowJson (new) or state (legacy) in request body
    const statePayload = body?.flowJson ?? body?.state;
    if (typeof statePayload === 'undefined') {
      return NextResponse.json({ error: 'Missing flowJson in body' }, { status: 400 });
    }

    const inserted = await insertCanvasState(canvasId, statePayload, userId);
    if (!inserted) {
      return NextResponse.json({ error: 'Failed to save canvas state' }, { status: 500 });
    }
    // RAG 동기화 제거: 지식 업로드/변경 시에만 수행
    return NextResponse.json(inserted, { status: 201 });
  } catch (error) {
    console.error('Canvas state POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


