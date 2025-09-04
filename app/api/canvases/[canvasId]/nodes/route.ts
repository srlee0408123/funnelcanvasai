import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase/service';

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

interface RouteParams {
  params: Promise<{
    canvasId: string;
  }>;
}

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

// 권한 확인 함수
async function checkCanvasAccess(supabase: any, canvasId: string, userId: string) {
  // 캔버스 존재 확인
  const { data: canvas, error: canvasError } = await supabase
    .from('canvases')
    .select('id, workspace_id')
    .eq('id', canvasId)
    .single();

  if (canvasError || !canvas) {
    return { hasAccess: false, error: 'Canvas not found', status: 404 };
  }

  // 워크스페이스 소유자인지 확인
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('id', canvas.workspace_id)
    .eq('owner_id', userId)
    .single();

  let hasAccess = !!workspace;

  // 소유자가 아니면 멤버인지 확인
  if (!hasAccess) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', canvas.workspace_id)
      .eq('user_id', userId)
      .single();
    
    hasAccess = !!membership;
  }

  if (!hasAccess) {
    return { hasAccess: false, error: 'Forbidden', status: 403 };
  }

  return { hasAccess: true, canvas };
}

// GET: 캔버스의 모든 노드 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { canvasId } = await params;
    const supabase = createServiceClient();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const accessCheck = await checkCanvasAccess(supabase, canvasId, userId);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    // 노드 목록 조회
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
}

// POST: 새 노드 생성 또는 기존 노드 업데이트
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { canvasId } = await params;
    const body = await request.json();
    const supabase = createServiceClient();

    const accessCheck = await checkCanvasAccess(supabase, canvasId, userId);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    // 단일 노드 저장 또는 일괄 저장 처리
    if (Array.isArray(body.nodes)) {
      // 일괄 노드 저장 (전체 캔버스 저장 시)
      const nodes: NodeData[] = body.nodes;
      
      // 기존 노드 삭제 후 새로 저장
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
          created_by: userId,
        }));

        const { data: insertedNodes, error: insertError } = await supabase
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
      // 단일 노드 저장
      const node: NodeData = body;
      
      if (!node.node_id || !node.type || !node.position || !node.data) {
        return NextResponse.json({ 
          error: 'Missing required node fields',
          required: ['node_id', 'type', 'position', 'data'],
          received: Object.keys(node)
        }, { status: 400 });
      }

      // 기존 노드가 있는지 확인하여 위치 유지
      const { data: existingNode } = await supabase
        .from('canvas_nodes')
        .select('position')
        .eq('canvas_id', canvasId)
        .eq('node_id', node.node_id)
        .single();

      // 기존 노드가 있으면 위치 유지, 없으면 새 위치 사용
      const finalPosition = existingNode ? existingNode.position : node.position;

      console.log('Saving node:', {
        canvas_id: canvasId,
        node_id: node.node_id,
        type: node.type,
        position: finalPosition,
        data: node.data,
        metadata: node.metadata || {},
        created_by: userId,
        isUpdate: !!existingNode
      });

      const { data: savedNode, error: saveError } = await supabase
        .from('canvas_nodes')
        .upsert({
          canvas_id: canvasId,
          node_id: node.node_id,
          type: node.type,
          position: finalPosition,
          data: node.data,
          metadata: node.metadata || {},
          created_by: userId,
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
}

// DELETE: 특정 노드 삭제 또는 모든 노드 삭제
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { canvasId } = await params;
    const { searchParams } = new URL(request.url);
    const nodeId = searchParams.get('nodeId');
    const supabase = createServiceClient();

    const accessCheck = await checkCanvasAccess(supabase, canvasId, userId);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: accessCheck.error }, { status: accessCheck.status });
    }

    if (nodeId) {
      // 특정 노드 삭제
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
      // 모든 노드 삭제
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
}