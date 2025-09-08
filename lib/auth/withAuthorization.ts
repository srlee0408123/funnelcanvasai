/**
 * withAuthorization.ts - API 라우트 권한 검증 HOF
 * 
 * 주요 역할:
 * 1. 라우트 핸들러 앞단에서 인증/권한을 공통 처리
 * 2. 비즈니스 로직을 순수하게 유지
 * 3. 선언형 옵션(minRole 등)으로 접근 제어
 * 
 * 핵심 특징:
 * - Clerk 인증 강제
 * - 리소스별 권한 검증(canvas/workspace)
 * - public canvas는 viewer 역할로 읽기 허용
 * 
 * 주의사항:
 * - 기본적으로 minRole 미지정 시 단순 hasAccess만 검사(POST/PUT/DELETE 등에는 minRole 권장)
 * - params가 Promise일 수 있으므로 안전 처리
 */

import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { canAccessCanvas, canAccessWorkspace, type AccessRole } from '@/lib/auth/permissions';
import { getCanvasAccessInfo, getUserProfileRole } from '@/lib/auth/auth-service';

type ResourceType = 'canvas' | 'workspace';

type AuthorizedHandler = (
  req: NextRequest,
  context: {
    params: any; // Next.js 15에서는 Promise 가능성이 있어 any 허용
    auth: { userId: string };
    resource?: any; // 검증된 리소스 (예: canvas 객체)
    role?: AccessRole; // 사용자 역할
  }
) => Promise<NextResponse>;

interface AuthOptions {
  resourceType: ResourceType;
  minRole?: AccessRole; // 필요 시 역할 기반 접근 제어
}

const ROLE_WEIGHT: Record<AccessRole, number> = {
  viewer: 0,
  editor: 1,
  member: 1,
  admin: 2,
  owner: 3
};

function isRoleSufficient(userRole: AccessRole | undefined, minRole: AccessRole): boolean {
  if (!userRole) return false;
  return ROLE_WEIGHT[userRole] >= ROLE_WEIGHT[minRole];
}

export function withAuthorization(options: AuthOptions, handler: AuthorizedHandler) {
  return async (req: NextRequest, { params }: { params: any }): Promise<NextResponse> => {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    // params가 Promise일 수도 있으므로 안전하게 처리
    const rawParams = params && typeof (params as any)?.then === 'function' ? await params : params;
    const resourceId = rawParams?.canvasId || rawParams?.workspaceId;
    if (!resourceId) {
      return NextResponse.json({ error: '리소스 ID가 필요합니다.' }, { status: 400 });
    }

    let permissionCheck:
      | Awaited<ReturnType<typeof canAccessCanvas>>
      | Awaited<ReturnType<typeof canAccessWorkspace>>;

    if (options.resourceType === 'canvas') {
      // 우선 중앙 접근 정보로 빠르게 판정
      const access = await getCanvasAccessInfo(userId, resourceId);
      if (!access.hasAccess) {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
      // 일부 호출부가 canvas 메타를 기대하므로 기존 함수로 최소 메타 포함 응답을 조합
      permissionCheck = await canAccessCanvas(userId, resourceId);
    } else if (options.resourceType === 'workspace') {
      permissionCheck = await canAccessWorkspace(userId, resourceId);
    } else {
      return NextResponse.json({ error: '알 수 없는 리소스 타입입니다.' }, { status: 500 });
    }

    if (!permissionCheck.hasAccess) {
      return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
    }

    // minRole 지정 시 역할 비교(POST/PUT/DELETE 등에 권장)
    if (options.minRole && !isRoleSufficient((permissionCheck as any)?.role as AccessRole | undefined, options.minRole)) {
      return NextResponse.json({ error: '권한이 부족합니다.' }, { status: 403 });
    }

    return handler(req, {
      params: rawParams,
      auth: { userId },
      resource: (permissionCheck as any)?.canvas,
      role: (permissionCheck as any)?.role as AccessRole | undefined
    });
  };
}

/**
 * withAdmin - 관리자 전용 API 라우트 가드
 * 클라이언트/서버에서 재사용 가능하도록 간단한 HOF 제공
 */
export function withAdmin(handler: (req: NextRequest, ctx: { auth: { userId: string } }) => Promise<NextResponse>) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }
    const profileRole = await getUserProfileRole(userId)
    if (profileRole !== 'admin') {
      return NextResponse.json({ error: '관리자만 접근 가능합니다.' }, { status: 403 });
    }
    return handler(req, { auth: { userId } })
  }
}


