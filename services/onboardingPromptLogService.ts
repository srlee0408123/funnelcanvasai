/**
 * onboardingPromptLogService.ts - 온보딩 프롬프트 변경 이력 서비스 (서버 전용)
 * 
 * 주요 역할:
 * 1. 온보딩 프롬프트 저장 시 스냅샷을 onboarding_prompt_logs에 적재
 * 2. 관리자가 최근 변경 로그를 조회할 수 있도록 제공
 * 
 * 주의사항:
 * - 서비스 로우 키 기반 Supabase 클라이언트 사용 (RLS 우회)
 */

import { createServiceClient } from '@/lib/supabase/service'

export class OnboardingPromptLogService {
  private readonly supabase = createServiceClient()

  async appendSnapshot(content: string, changedBy?: string | null): Promise<void> {
    await (this.supabase as any)
      .from('onboarding_prompt_logs')
      .insert({ content, changed_by: changedBy ?? null })
  }

  async list(limit: number = 20): Promise<{ id: string; content: string; changed_by: string | null; changed_at: string }[]> {
    const { data, error } = await (this.supabase as any)
      .from('onboarding_prompt_logs')
      .select('id, content, changed_by, changed_at')
      .order('changed_at', { ascending: false })
      .limit(Math.max(1, Math.min(50, limit)))
    if (error) throw error
    return (data || []).map((d: any) => ({
      id: String(d.id),
      content: String(d.content),
      changed_by: d.changed_by ? String(d.changed_by) : null,
      changed_at: String(d.changed_at),
    }))
  }
}

export const onboardingPromptLogService = new OnboardingPromptLogService()


