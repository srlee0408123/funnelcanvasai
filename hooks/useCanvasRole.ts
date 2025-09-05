/**
 * useCanvasRole - 특정 캔버스에 대한 현재 사용자의 최종 역할과 권한 훅
 * 
 * 주요 역할:
 * 1. 백엔드 역할 해석 API와 연동하여 최종 역할(viewer/editor/member/admin/owner) 제공
 * 2. 역할에 따른 편의 boolean 권한 플래그 제공(canEdit, canShare 등)
 * 3. React Query를 통해 캐싱 및 자동 갱신
 * 
 * 핵심 특징:
 * - 권한 로직을 중앙화하여 DRY 준수
 * - 단일 책임: 역할 계산과 권한 플래그 도출
 * - 네이밍 명확성: useCanvasRole
 * 
 * 주의사항:
 * - canvasId가 없으면 비활성화
 * - 서버 응답 형태 { role: string }
 */
import { useQuery } from '@tanstack/react-query';

export interface CanvasPermissions {
  canView: boolean;
  canEdit: boolean;
  canShare: boolean;
  canDelete: boolean;
}

export function useCanvasRole(canvasId: string) {
  const { data, isLoading } = useQuery<{ role: string | null | undefined}>({
    queryKey: ['canvas-role', canvasId],
    queryFn: async () => {
      const res = await fetch(`/api/canvases/${canvasId}/role`, { credentials: 'include' });
      if (!res.ok) return { role: null };
      return res.json();
    },
    enabled: !!canvasId,
  });

  const role = data?.role ?? null;

  const permissions: CanvasPermissions = (() => {
    switch (role) {
      case 'owner':
      case 'admin':
        return { canView: true, canEdit: true, canShare: true, canDelete: true };
      case 'member':
      case 'editor':
        return { canView: true, canEdit: true, canShare: true, canDelete: false };
      case 'viewer':
        return { canView: true, canEdit: false, canShare: false, canDelete: false };
      default:
        return { canView: false, canEdit: false, canShare: false, canDelete: false };
    }
  })();

  return {
    role,
    permissions,
    isLoading,
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isMember: role === 'member',
    isEditor: role === 'editor',
    isViewer: role === 'viewer',
    canEdit: permissions.canEdit,
    canShare: permissions.canShare,
  };
}


