import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@/lib/supabase/server';

/**
 * edges/route.ts - Canvas edges (connections) management
 * 
 * 주요 역할:
 * 1. 노드 간 연결선(엣지) 데이터를 JSON metadata와 함께 저장
 * 2. 캔버스의 모든 엣지 조회
 * 3. 엣지 일괄 업데이트 (전체 캔버스 저장 시)
 * 
 * 핵심 특징:
 * - 각 엣지는 고유한 edge_id와 JSON metadata를 가짐
 * - source/target 노드 참조를 통한 연결 관계 관리
 * - 엣지 타입과 스타일 데이터 저장 지원
 * 
 * 주의사항:
 * - edge_id는 캔버스 내에서 고유해야 함
 * - source/target 노드가 존재해야 함 (외래키 제약)
 * - 메타데이터는 유효한 JSON 형태여야 함
 */

interface RouteParams {
  params: Promise<{
    canvasId: string;
  }>;
}

interface EdgeData {
  edge_id: string;
  source_node_id: string;
  target_node_id: string;
  type?: string;
  data?: Record<string, any>;
  metadata?: Record<string, any>;
}

// GET: 캔버스의 모든 엣지 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { canvasId } = await params;
    const supabase = await createClient();

    // 캔버스 접근 권한 확인
    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
    }

    // 공개 캔버스가 아닌 경우 권한 확인
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

    // 엣지 목록 조회
    const { data: edges, error: edgesError } = await supabase
      .from('canvas_edges')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true });

    if (edgesError) {
      console.error('Failed to fetch edges:', edgesError);
      return NextResponse.json({ error: 'Failed to fetch edges' }, { status: 500 });
    }

    return NextResponse.json({ edges: edges || [] });
  } catch (error) {
    console.error('Edges GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: 새 엣지 생성 또는 기존 엣지 업데이트
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { canvasId } = await params;
    const body = await request.json();
    const supabase = await createClient();

    // 캔버스 접근 권한 확인
    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
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

    // 단일 엣지 저장 또는 일괄 저장 처리
    if (Array.isArray(body.edges)) {
      // 일괄 엣지 저장 (전체 캔버스 저장 시)
      const edges: EdgeData[] = body.edges;
      
      // 기존 엣지 삭제 후 새로 저장
      await supabase
        .from('canvas_edges')
        .delete()
        .eq('canvas_id', canvasId);

      if (edges.length > 0) {
        const edgesToInsert = edges.map(edge => ({
          canvas_id: canvasId,
          edge_id: edge.edge_id,
          source_node_id: edge.source_node_id,
          target_node_id: edge.target_node_id,
          type: edge.type || 'default',
          data: edge.data || {},
          metadata: edge.metadata || {},
          created_by: userId,
        }));

        const { data: insertedEdges, error: insertError } = await supabase
          .from('canvas_edges')
          .insert(edgesToInsert)
          .select('*');

        if (insertError) {
          console.error('Failed to save edges:', insertError);
          return NextResponse.json({ error: 'Failed to save edges' }, { status: 500 });
        }

        return NextResponse.json({ edges: insertedEdges }, { status: 201 });
      }

      return NextResponse.json({ edges: [] }, { status: 201 });
    } else {
      // 단일 엣지 저장
      const edge: EdgeData = body;
      
      if (!edge.edge_id || !edge.source_node_id || !edge.target_node_id) {
        return NextResponse.json({ error: 'Missing required edge fields' }, { status: 400 });
      }

      const { data: savedEdge, error: saveError } = await supabase
        .from('canvas_edges')
        .upsert({
          canvas_id: canvasId,
          edge_id: edge.edge_id,
          source_node_id: edge.source_node_id,
          target_node_id: edge.target_node_id,
          type: edge.type || 'default',
          data: edge.data || {},
          metadata: edge.metadata || {},
          created_by: userId,
        })
        .select('*')
        .single();

      if (saveError) {
        console.error('Failed to save edge:', saveError);
        return NextResponse.json({ error: 'Failed to save edge' }, { status: 500 });
      }

      return NextResponse.json({ edge: savedEdge }, { status: 201 });
    }
  } catch (error) {
    console.error('Edges POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: 특정 엣지 삭제 또는 모든 엣지 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { canvasId } = await params;
    const { searchParams } = new URL(request.url);
    const edgeId = searchParams.get('edgeId');
    const supabase = await createClient();

    // 캔버스 접근 권한 확인
    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('*')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 });
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

    if (edgeId) {
      // 특정 엣지 삭제
      const { error: deleteError } = await supabase
        .from('canvas_edges')
        .delete()
        .eq('canvas_id', canvasId)
        .eq('edge_id', edgeId);

      if (deleteError) {
        console.error('Failed to delete edge:', deleteError);
        return NextResponse.json({ error: 'Failed to delete edge' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Edge deleted successfully' });
    } else {
      // 모든 엣지 삭제
      const { error: deleteError } = await supabase
        .from('canvas_edges')
        .delete()
        .eq('canvas_id', canvasId);

      if (deleteError) {
        console.error('Failed to delete edges:', deleteError);
        return NextResponse.json({ error: 'Failed to delete edges' }, { status: 500 });
      }

      return NextResponse.json({ message: 'All edges deleted successfully' });
    }
  } catch (error) {
    console.error('Edges DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
