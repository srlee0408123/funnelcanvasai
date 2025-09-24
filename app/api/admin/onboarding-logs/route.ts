import { NextResponse } from 'next/server'
import { withAdmin } from '@/lib/auth/withAuthorization'
import { onboardingPromptLogService } from '@/services/onboardingPromptLogService'

export const GET = withAdmin(async (req) => {
  try {
    const url = new URL(req.url)
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? Math.min(50, Math.max(1, Number(limitParam))) : 20
    const logs = await onboardingPromptLogService.list(limit)
    return NextResponse.json({ success: true, data: logs })
  } catch (error) {
    console.error('Onboarding logs list error:', error)
    return NextResponse.json({ success: false, error: '로그 조회 실패' }, { status: 500 })
  }
})


