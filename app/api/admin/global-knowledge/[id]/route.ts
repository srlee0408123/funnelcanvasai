import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/auth/withAuthorization'
import { deleteGlobalKnowledge } from '@/services/storageService'

export const DELETE = withAdmin(async (req: NextRequest) => {
  const url = new URL(req.url)
  const id = url.pathname.split('/').pop()
  if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
  await deleteGlobalKnowledge(id)
  return NextResponse.json({ ok: true })
})


