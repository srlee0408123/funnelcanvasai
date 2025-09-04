/**
 * permissions.ts - 중앙 권한 검증 서비스
 * 
 * 주요 역할:
 * 1. 워크스페이스/캔버스 접근 권한 검증을 단일 위치에서 수행
 * 2. 서비스 로우 키(client)로 RLS 우회 조회
 * 3. 리소스 접근 시 역할 정보를 함께 반환
 * 
 * 핵심 특징:
 * - 공개 캔버스 읽기 접근(viewer) 허용
 * - 워크스페이스 소유자/멤버 기반 권한 판정
 * - 비즈니스 로직으로부터 권한 체크 로직 분리
 * 
 * 주의사항:
 * - 서비스 로우 키 사용으로 보안에 유의
 * - 역할 스킴 변경 시 이 파일만 수정하여 전체 반영
 * - canvas의 작성자 컬럼은 user_id로 간주(스키마 최신화 필요 시 반영)
 */

import { createServiceClient } from '@/lib/supabase/service';
import type { Database } from '@/lib/database.types';

const supabase = createServiceClient();

export type WorkspaceRole = Database['public']['Tables']['workspace_members']['Row']['role']; // 'owner' | 'admin' | 'member'
export type AccessRole = WorkspaceRole | 'viewer';

/**
 * 사용자가 특정 워크스페이스에 접근 권한이 있는지 확인 (소유자 또는 멤버)
 */
export async function canAccessWorkspace(
  userId: string,
  workspaceId: string
): Promise<{ hasAccess: boolean; role?: AccessRole }> {
  // 1) 워크스페이스 소유자 확인
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', workspaceId)
    .single();

  if (wsError || !workspace) return { hasAccess: false };
  if (workspace.owner_id === userId) return { hasAccess: true, role: 'owner' };

  // 2) 워크스페이스 멤버 확인
  const { data: member, error: memberError } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (memberError || !member) return { hasAccess: false };
  return { hasAccess: true, role: member.role };
}

/**
 * 사용자가 특정 캔버스에 접근 권한이 있는지 확인
 * - 공개 캔버스: 읽기 접근 viewer 부여
 * - 캔버스 작성자(user_id) 또는 워크스페이스 멤버: 접근 허용
 */
export async function canAccessCanvas(
  userId: string,
  canvasId: string
): Promise<{
  hasAccess: boolean;
  role?: AccessRole;
  canvas?: Pick<Database['public']['Tables']['canvases']['Row'], 'id' | 'workspace_id' | 'is_public' | 'user_id'>;
}> {
  const { data: canvas, error: canvasError } = await supabase
    .from('canvases')
    .select('id, workspace_id, is_public, user_id')
    .eq('id', canvasId)
    .single();

  if (canvasError || !canvas) return { hasAccess: false };

  // 공개 캔버스 → 읽기(viewer) 허용
  if (canvas.is_public) {
    return { hasAccess: true, role: 'viewer', canvas };
  }

  // 캔버스 작성자
  if (canvas.user_id === userId) {
    return { hasAccess: true, role: 'owner', canvas };
  }

  // 워크스페이스 권한 위임
  if (!canvas.workspace_id) {
    return { hasAccess: false, role: undefined, canvas };
  }
  
  const ws = await canAccessWorkspace(userId, canvas.workspace_id);
  return { ...ws, canvas };
}


