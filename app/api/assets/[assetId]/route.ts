import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/service";
import { canAccessCanvas } from "@/lib/auth/permissions";

/**
 * assets/[assetId]/route.ts - 업로드 자료(지식 항목) 삭제 API
 * 
 * 주요 역할:
 * 1. Sidebar에서 호출하는 `/api/assets/:assetId` 삭제 요청 처리
 * 2. Clerk 인증 및 캔버스 접근 권한(최소 member) 검증
 * 3. `canvas_knowledge` 테이블의 해당 레코드 삭제
 * 
 * 핵심 특징:
 * - 기존 라우트 부재로 404가 발생하던 문제 해결
 * - assetId로 지식 레코드를 조회 후 캔버스 권한 확인
 * - 서비스 키로 RLS 우회하되, 애플리케이션 레벨에서 권한 엄격 검증
 * 
 * 주의사항:
 * - 이 엔드포인트는 `canvas_knowledge` 레코드를 삭제합니다
 * - 연관된 청크가 FK on delete cascade면 자동 정리됩니다
 * - 최소 member 이상의 역할이 필요합니다(viewer 불가)
 */

export const DELETE = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    // Next.js 15에서 params가 Promise일 수 있어 방어적으로 처리
    const rawParams = params && typeof (params as any)?.then === "function" ? await params : params;
    const assetId = rawParams?.assetId as string | undefined;

    if (!assetId) {
      return NextResponse.json({ error: "assetId가 필요합니다." }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 1) 자원 조회 (어떤 캔버스에 속하는지 파악)
    const { data: knowledge, error: fetchError } = await (supabase as any)
      .from("canvas_knowledge")
      .select("id, canvas_id")
      .eq("id", assetId)
      .single();

    if (fetchError || !knowledge) {
      return NextResponse.json({ error: "삭제할 자료를 찾을 수 없습니다." }, { status: 404 });
    }

    // 2) 권한 확인 (해당 캔버스에 대한 최소 member 권한)
    const access = await canAccessCanvas(userId, knowledge.canvas_id as string);
    if (!access.hasAccess) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }
    // viewer는 쓰기 작업 불가
    if (access.role === "viewer") {
      return NextResponse.json({ error: "권한이 부족합니다." }, { status: 403 });
    }

    // 3) 삭제 수행
    const { error: deleteError } = await (supabase as any)
      .from("canvas_knowledge")
      .delete()
      .eq("id", assetId)
      .eq("canvas_id", knowledge.canvas_id);

    if (deleteError) {
      console.error("Failed to delete knowledge asset:", deleteError);
      return NextResponse.json({ error: "자료 삭제에 실패했습니다." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Asset DELETE API error:", error);
    return NextResponse.json(
      { error: "자료 삭제 중 오류가 발생했습니다.", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
};


