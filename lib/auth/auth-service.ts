/**
 * auth-service.ts - 중앙 권한 검증 서비스
 * 
 * 주요 역할:
 * 1. 캔버스 접근 권한 최종 판정(공개/워크스페이스/개별 공유/소유자)
 * 2. 서비스 로우 클라이언트를 사용하여 RLS를 우회한 일관된 확인
 * 3. API/HOF/권한 유틸에서 재사용되는 단일 진실 공급원
 * 
 * 핵심 특징:
 * - 공개 캔버스는 로그인 없이 viewer 권한 부여
 * - 생성자/워크스페이스 역할/개별 공유(canvas_shares) 모두 고려
 * - 단일 호출로 hasAccess와 role을 함께 제공
 * 
 * 주의사항:
 * - 서비스 로우 키 사용으로 서버 환경에서만 사용해야 함
 * - 역할 스키마 변경 시 이 파일만 업데이트하면 전체 반영
 * - 반환 role은 'owner' | 'admin' | 'member' | 'editor' | 'viewer' | null
 */

import { createServiceClient } from '@/lib/supabase/service'

export type AccessInfo = {
  hasAccess: boolean
  role: 'owner' | 'admin' | 'member' | 'editor' | 'viewer' | null
}

export type ProfileRole = 'admin' | 'user'

/**
 * 현재 사용자의 프로필 기반 시스템 역할을 조회합니다.
 * admin | user 중 하나를 반환합니다.
 */
export async function getUserProfileRole(userId: string | null): Promise<ProfileRole> {
  if (!userId) return 'user'
  const supabase = createServiceClient()
  const { data } = await (supabase as any)
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()
  const role = (data as any)?.role as ProfileRole | undefined
  return role === 'admin' ? 'admin' : 'user'
}

/**
 * 사용자의 특정 캔버스에 대한 최종 접근 권한과 역할을 반환합니다.
 * (공개 여부, 워크스페이스 멤버십, 개별 공유 모두 고려)
 */
export async function getCanvasAccessInfo(userId: string | null, canvasId: string): Promise<AccessInfo> {
  const supabase = createServiceClient()

  const { data: canvas, error } = await supabase
    .from('canvases')
    .select('workspace_id, is_public, created_by')
    .eq('id', canvasId)
    .single()

  if (error || !canvas) return { hasAccess: false, role: null }

  // 1. 공개 캔버스는 누구나 'viewer'
  if (canvas.is_public) return { hasAccess: true, role: 'viewer' }

  // 2. 비공개 캔버스는 로그인이 필수
  if (!userId) return { hasAccess: false, role: null }

  // 3. 캔버스 생성자(소유자)
  if ((canvas as any).created_by === userId) return { hasAccess: true, role: 'owner' }

  // 4. 개별 공유 확인 (canvas_shares)
  const { data: share } = await (supabase as any)
    .from('canvas_shares')
    .select('role')
    .eq('canvas_id', canvasId)
    .eq('user_id', userId)
    .maybeSingle()
  if (share) return { hasAccess: true, role: (share as any).role as 'editor' | 'viewer' }

  // 5. 워크스페이스 소유자 또는 멤버 확인
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('owner_id')
    .eq('id', canvas.workspace_id as any)
    .single()
  if (workspace && (workspace as any).owner_id === userId) return { hasAccess: true, role: 'owner' }

  const { data: member } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', canvas.workspace_id as any)
    .eq('user_id', userId)
    .maybeSingle()
  if (member) return { hasAccess: true, role: (member as any).role }

  return { hasAccess: false, role: null }
}


