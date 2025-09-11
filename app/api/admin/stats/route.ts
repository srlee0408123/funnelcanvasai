import { NextResponse } from 'next/server'
import { withAdmin } from '@/lib/auth/withAuthorization'
import { createServiceClient } from '@/lib/supabase/service'

export const GET = withAdmin(async () => {
  try {
    const supabase = createServiceClient()

    const [{ count: userCount }, { count: canvasCount }, { count: templateCount }] = await Promise.all([
      (supabase as any).from('profiles').select('*', { count: 'exact', head: true }),
      (supabase as any).from('canvases').select('*', { count: 'exact', head: true }),
      (supabase as any).from('funnel_templates').select('*', { count: 'exact', head: true }),
    ])

    return NextResponse.json({
      totalUsers: userCount || 0,
      totalCanvases: canvasCount || 0,
      totalTemplates: templateCount || 0,
    })
  } catch (error) {
    console.error('Admin stats error:', error)
    return NextResponse.json({ error: '통계 조회 실패' }, { status: 500 })
  }
})


