import { NextResponse } from 'next/server'
import { withAdmin } from '@/lib/auth/withAuthorization'
import { ragPromptService } from '@/services/ragPromptService'

export const GET = withAdmin(async () => {
  try {
    const list = await ragPromptService.list()
    return NextResponse.json({ success: true, data: list })
  } catch (error) {
    console.error('RAG prompts list error:', error)
    return NextResponse.json({ success: false, error: '목록 조회 실패' }, { status: 500 })
  }
})

export const POST = withAdmin(async (req, { auth }) => {
  try {
    const body = await req.json()
    const name = String(body?.name || '').trim()
    const content = String(body?.content || '').trim()
    const is_active = typeof body?.is_active === 'boolean' ? body.is_active : true
    const version = Number.isFinite(Number(body?.version)) ? Number(body.version) : 1

    if (!name || !content) {
      return NextResponse.json({ success: false, error: 'name과 content는 필수입니다.' }, { status: 400 })
    }

    const created = await ragPromptService.create({ name, content, is_active, version, created_by: auth.userId })
    return NextResponse.json({ success: true, data: created })
  } catch (error) {
    console.error('RAG prompts create error:', error)
    return NextResponse.json({ success: false, error: '생성 실패' }, { status: 500 })
  }
})


