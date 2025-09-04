import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { withAuthorization } from '@/lib/auth/withAuthorization';

/**
 * nodes/route.ts - Canvas nodes management
 * 
 * 주요 역할:
 * 1. 개별 노드 데이터를 JSON metadata와 함께 저장
 * 2. 캔버스의 모든 노드 조회
 * 3. 노드 일괄 업데이트 (전체 캔버스 저장 시)
 * 
 * 핵심 특징:
 * - 각 노드는 고유한 node_id와 JSON metadata를 가짐
 * - 위치, 데이터, 메타데이터를 별도 필드로 구조화
 * - 캔버스 접근 권한 검증 포함
 * 
 * 주의사항:
 * - node_id는 캔버스 내에서 고유해야 함
 * - 메타데이터는 유효한 JSON 형태여야 함
 * - 권한 검증을 통해 무단 접근 방지
 */

interface NodeData {
  node_id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    title: string;
    subtitle?: string;
    icon: string;
    color: string;
    [key: string]: any;
  };
  metadata?: Record<string, any>;
}

// GET: 캔버스의 모든 노드 조회
const getNodes = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const { canvasId } = await params;
    const supabase = createServiceClient();

    const { data: nodes, error: nodesError } = await supabase
      .from('canvas_nodes')
      .select('*')
      .eq('canvas_id', canvasId)
      .order('created_at', { ascending: true });

    if (nodesError) {
      console.error('Failed to fetch nodes:', nodesError);
      return NextResponse.json({ error: 'Failed to fetch nodes' }, { status: 500 });
    }

    return NextResponse.json({ nodes: nodes || [] });
  } catch (error) {
    console.error('Nodes GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};

// POST: 새 노드 생성 또는 기존 노드 업데이트
const postNodes = async (
  request: NextRequest,
  { params, auth }: { params: any; auth: { userId: string } }
) => {
  try {
    const { canvasId } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    // 단일 노드 저장 또는 일괄 저장 처리
    if (Array.isArray(body.nodes)) {
      const nodes: NodeData[] = body.nodes;

      await supabase
        .from('canvas_nodes')
        .delete()
        .eq('canvas_id', canvasId);

      if (nodes.length > 0) {
        const nodesToInsert = nodes.map(node => ({
          canvas_id: canvasId,
          node_id: node.node_id,
          type: node.type,
          position: node.position,
          data: node.data,
          metadata: node.metadata || {},
          created_by: auth.userId,
        }));

        const { data: insertedNodes, error: insertError } = await (supabase as any)
          .from('canvas_nodes')
          .insert(nodesToInsert)
          .select('*');

        if (insertError) {
          console.error('Failed to save nodes:', insertError);
          return NextResponse.json({ error: 'Failed to save nodes', details: insertError }, { status: 500 });
        }

        return NextResponse.json({ nodes: insertedNodes }, { status: 201 });
      }

      return NextResponse.json({ nodes: [] }, { status: 201 });
    } else {
      const node: NodeData = body;

      if (!node.node_id || !node.type || !node.position || !node.data) {
        return NextResponse.json({
          error: 'Missing required node fields',
          required: ['node_id', 'type', 'position', 'data'],
          received: Object.keys(node)
        }, { status: 400 });
      }

      const { data: existingNode } = await supabase
        .from('canvas_nodes')
        .select('position')
        .eq('canvas_id', canvasId)
        .eq('node_id', node.node_id)
        .single();

      const existingNodeRow = existingNode as { position: { x: number; y: number } } | null;
      const finalPosition = existingNodeRow ? existingNodeRow.position : node.position;

      const { data: savedNode, error: saveError } = await (supabase as any)
        .from('canvas_nodes')
        .upsert({
          canvas_id: canvasId,
          node_id: node.node_id,
          type: node.type,
          position: finalPosition,
          data: node.data,
          metadata: node.metadata || {},
          created_by: auth.userId,
        })
        .select('*')
        .single();

      if (saveError) {
        console.error('Failed to save node:', saveError);
        return NextResponse.json({
          error: 'Failed to save node',
          details: saveError
        }, { status: 500 });
      }

      return NextResponse.json({ node: savedNode }, { status: 201 });
    }
  } catch (error) {
    console.error('Nodes POST error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

// DELETE: 특정 노드 삭제 또는 모든 노드 삭제
const deleteNodes = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const { canvasId } = await params;
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const supabase = createServiceClient();

    if (nodeId) {
      const { error: deleteError } = await supabase
        .from('canvas_nodes')
        .delete()
        .eq('canvas_id', canvasId)
        .eq('node_id', nodeId);

      if (deleteError) {
        console.error('Failed to delete node:', deleteError);
        return NextResponse.json({ error: 'Failed to delete node' }, { status: 500 });
      }

      return NextResponse.json({ message: 'Node deleted successfully' });
    } else {
      const { error: deleteError } = await supabase
        .from('canvas_nodes')
        .delete()
        .eq('canvas_id', canvasId);

      if (deleteError) {
        console.error('Failed to delete nodes:', deleteError);
        return NextResponse.json({ error: 'Failed to delete nodes' }, { status: 500 });
      }

      return NextResponse.json({ message: 'All nodes deleted successfully' });
    }
  } catch (error) {
    console.error('Nodes DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
};

export const GET = withAuthorization({ resourceType: 'canvas' }, getNodes);
export const POST = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, postNodes);
export const DELETE = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, deleteNodes);
