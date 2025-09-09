import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserWorkspaces, createWorkspace } from "@/services/workspace-service";
import { isFreePlan, countOwnedWorkspaces } from "@/lib/planLimits";

export async function GET() {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const workspaces = await getUserWorkspaces(userId);
    // 안전 필드만 반환 (id, name, created_at, updated_at)
    return NextResponse.json(workspaces);
  } catch (error) {
    console.error('Failed to fetch user workspaces:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name } = await req.json();
    
    if (!name) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }
    // Free plan: allow only 1 owned workspace
    try {
      const free = await isFreePlan(userId);
      if (free) {
        const ownedCount = await countOwnedWorkspaces(userId);
        if (ownedCount >= 1) {
          return NextResponse.json({
            error: '무료 플랜에서는 워크스페이스를 1개까지만 생성할 수 있습니다.',
            code: 'FREE_PLAN_LIMIT_WORKSPACES',
            limit: 1
          }, { status: 403 });
        }
      }
    } catch (planErr) {
      console.warn('Workspace plan check failed, proceeding cautiously:', planErr);
    }
    const created = await createWorkspace(userId, name);
    if (!created) {
      return NextResponse.json({ error: 'Failed to create workspace' }, { status: 500 });
    }
    // 생성 응답도 안전 필드만 반환
    const safe = {
      id: (created as any).id,
      name: (created as any).name,
      created_at: (created as any).created_at,
      updated_at: (created as any).updated_at,
    }
    return NextResponse.json(safe);
  } catch (error) {
    console.error("Unexpected error in POST /api/workspaces:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
