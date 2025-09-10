import { NextResponse } from 'next/server'
import { withAdmin } from '@/lib/auth/withAuthorization'
import { ragPromptService } from '@/services/ragPromptService'

export const PATCH = withAdmin(async (req, { auth }) => {
  try {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    if (!id) {
      return NextResponse.json({ success: false, error: 'id가 필요합니다.' }, { status: 400 })
    }
    const body = await req.json()
    const updates: any = {}
    if (typeof body?.name === 'string') updates.name = String(body.name)
    if (typeof body?.content === 'string') updates.content = String(body.content)
    if (typeof body?.is_active === 'boolean') updates.is_active = Boolean(body.is_active)
    if (Number.isFinite(Number(body?.version))) updates.version = Number(body.version)

    const updated = await ragPromptService.update(id, updates, auth.userId)
    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    console.error('RAG prompts update error:', error)
    return NextResponse.json({ success: false, error: '업데이트 실패' }, { status: 500 })
  }
})

export const DELETE = withAdmin(async (req) => {
  try {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    if (!id) {
      return NextResponse.json({ success: false, error: 'id가 필요합니다.' }, { status: 400 })
    }
    await ragPromptService.remove(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('RAG prompts delete error:', error)
    return NextResponse.json({ success: false, error: '삭제 실패' }, { status: 500 })
  }
})

// 로그 조회: 최신 10개 (선택적으로 limit 쿼리 파라미터)
export const GET = withAdmin(async (req) => {
  try {
    const url = new URL(req.url)
    const id = url.pathname.split('/').pop() as string
    const limitParam = url.searchParams.get('limit')
    const limit = limitParam ? Math.min(50, Math.max(1, Number(limitParam))) : 10
    if (!id) {
      return NextResponse.json({ success: false, error: 'id가 필요합니다.' }, { status: 400 })
    }
    const logs = await ragPromptService.listLogs(id, limit)
    return NextResponse.json({ success: true, data: logs })
  } catch (error) {
    console.error('RAG prompts logs error:', error)
    return NextResponse.json({ success: false, error: '로그 조회 실패' }, { status: 500 })
  }
})


