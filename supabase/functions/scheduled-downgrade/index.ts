// @ts-nocheck
/**
 * scheduled-downgrade - cancel_at_period_end=true 건의 만료 시점에 plan을 free로 다운그레이드
 *
 * 주요 역할:
 * 1. payments 테이블에서 scheduled_downgrade_at <= now, processed=false 레코드 조회
 * 2. 해당 레코드의 사용자(전화번호 우선, 이메일 보조) -> profiles -> workspaces.plan='free' 업데이트
 * 3. 중복 처리 방지 위해 scheduled_downgrade_processed=true 로 마킹
 *
 * 핵심 특징:
 * - Supabase Edge Function으로 5분~1시간 간격 스케줄 실행 가능
 * - 부분 실패에도 다음 실행에서 재시도 (processed=false 기준)
 *
 * 주의사항:
 * - 환경변수: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 제공 필요(Edge Functions 기본 제공)
 * - 트랜잭션 수준 보장은 제한적이므로, 소량 배치/반복 실행으로 내구성 확보
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type PaymentRow = {
  id: string;
  email: string;
  phone_number: string | null;
  scheduled_downgrade_at: string | null;
};

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders } });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return json({ ok: false, error: "Missing Supabase env" }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    // 1) 대상 결제 조회 (만료 시점 도달 + 미처리)
    const nowIso = new Date().toISOString();
    const { data: targets, error: selErr } = await supabase
      .from("payments")
      .select("id, email, phone_number, scheduled_downgrade_at")
      .lte("scheduled_downgrade_at", nowIso)
      .eq("scheduled_downgrade_processed", false)
      .order("scheduled_downgrade_at", { ascending: true })
      .limit(200);

    if (selErr) {
      console.error("Select payments error:", selErr);
      return json({ ok: false, error: selErr.message || String(selErr) }, 500);
    }

    if (!targets || targets.length === 0) {
      return json({ ok: true, processed: 0 });
    }

    let successCount = 0;
    for (const p of targets as PaymentRow[]) {
      try {
        // 2) 프로필 찾기: phone -> email 순
        let profileId: string | null = null;
        if (p.phone_number) {
          const { data: profByPhone } = await supabase
            .from("profiles")
            .select("id")
            .eq("phone_number", p.phone_number)
            .maybeSingle();
          profileId = profByPhone?.id ?? null;
        }
        if (!profileId && p.email) {
          const { data: profByEmail } = await supabase
            .from("profiles")
            .select("id")
            .eq("email", p.email)
            .maybeSingle();
          profileId = profByEmail?.id ?? null;
        }

        if (!profileId) {
          console.warn("No profile for payment; mark processed only", { paymentId: p.id });
          await markProcessed(supabase, p.id);
          continue;
        }

        // 1) Downgrade profile plan
        const { error: profErr } = await supabase
          .from("profiles")
          .update({ plan: "free" })
          .eq("id", profileId);
        if (profErr) {
          console.error("Profile downgrade error:", profErr);
          continue; // don't mark processed; will retry next run
        }

        // 2) Downgrade all owned workspaces plan
        const { error: upErr } = await supabase
          .from("workspaces")
          .update({ plan: "free" })
          .eq("owner_id", profileId);
        if (upErr) {
          console.error("Workspace downgrade error:", upErr);
          continue; // don't mark processed; will retry next run
        }

        await markProcessed(supabase, p.id);
        successCount++;
      } catch (e) {
        console.error("Process payment failed:", p.id, e);
      }
    }

    return json({ ok: true, processed: successCount, total: targets.length });
  } catch (e) {
    console.error("scheduled-downgrade fatal error:", e);
    return json({ ok: false, error: String(e) }, 500);
  }
});

async function markProcessed(supabase: any, paymentId: string) {
  await supabase
    .from("payments")
    .update({ scheduled_downgrade_processed: true, updated_at: new Date().toISOString() })
    .eq("id", paymentId);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}


