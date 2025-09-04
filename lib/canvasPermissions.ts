/**
 * Canvas 권한 검사 유틸리티
 * 
 * RLS 정책을 API 레벨에서 구현하여 권한을 관리합니다.
 * 
 * 권한 규칙:
 * 1. 워크스페이스 소유자 (owner_id)
 * 2. 워크스페이스 멤버 (workspace_members)
 */

import { createServiceClient } from '@/lib/supabase/service';

export interface CanvasPermissionResult {
  hasAccess: boolean;
  canvas?: {
    id: string;
    workspace_id: string;
  };
  error?: string;
}

/**
 * 사용자가 특정 캔버스에 접근할 권한이 있는지 확인
 */
export async function checkCanvasAccess(
  canvasId: string, 
  userId: string
): Promise<CanvasPermissionResult> {
  try {
    const supabase = createServiceClient();

    // 캔버스 정보 조회
    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('id, workspace_id')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas) {
      return {
        hasAccess: false,
        error: '캔버스를 찾을 수 없습니다.'
      };
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

    return {
      hasAccess,
      canvas,
      error: hasAccess ? undefined : '이 캔버스에 접근할 권한이 없습니다.'
    };

  } catch (error) {
    console.error('Canvas permission check error:', error);
    return {
      hasAccess: false,
      error: '권한 확인 중 오류가 발생했습니다.'
    };
  }
}

/**
 * API 라우터에서 사용할 권한 검사 미들웨어
 */
export async function requireCanvasAccess(
  canvasId: string,
  userId: string | null
): Promise<{ success: true; canvas: { id: string; workspace_id: string } } | { success: false; response: Response }> {
  
  // 사용자 인증 확인
  if (!userId) {
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: '인증이 필요합니다.' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    };
  }

  // 캔버스 접근 권한 확인
  const permissionResult = await checkCanvasAccess(canvasId, userId);
  
  if (!permissionResult.hasAccess) {
    const status = permissionResult.error?.includes('찾을 수 없습니다') ? 404 : 403;
    return {
      success: false,
      response: new Response(
        JSON.stringify({ error: permissionResult.error }),
        { 
          status,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    };
  }

  return {
    success: true,
    canvas: permissionResult.canvas!
  };
}

