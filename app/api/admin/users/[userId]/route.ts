import { NextRequest, NextResponse } from 'next/server'
import { withAdmin } from '@/lib/auth/withAuthorization'
import { createServiceClient } from '@/lib/supabase/service'

function normalizeKRPhone(input: string | null | undefined): string | null {
  if (!input) return null
  const digits = String(input).replace(/\D/g, '')
  if (digits.length === 8) return `010${digits}`
  if (digits.startsWith('010')) return digits.slice(0, 11)
  return digits || null
}

function isValidKRPhone(digitsOnly: string | null | undefined): boolean {
  if (!digitsOnly) return false
  return /^010\d{8}$/.test(digitsOnly)
}

function maskKRPhone(digitsOnly: string | null | undefined): string | null {
  const d = normalizeKRPhone(digitsOnly)
  if (!d) return null
  return '010********'
}

export const PATCH = withAdmin(async (req: NextRequest) => {
  try {
    const url = new URL(req.url)
    const userId = url.pathname.split('/').pop() as string
    if (!userId) {
      return NextResponse.json({ success: false, error: 'userId가 필요합니다.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    const body = await req.json().catch(() => ({}))

    const updates: Record<string, any> = { updated_at: new Date().toISOString() }

    if (typeof body?.plan === 'string') {
      const plan = String(body.plan)
      if (plan !== 'free' && plan !== 'pro') {
        return NextResponse.json({ success: false, error: 'plan은 free 또는 pro여야 합니다.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
      }
      updates.plan = plan
    }

    if (typeof body?.phoneNumber === 'string') {
      const normalized = normalizeKRPhone(body.phoneNumber)
      if (!isValidKRPhone(normalized)) {
        return NextResponse.json({ success: false, error: '전화번호 형식이 올바르지 않습니다. 010XXXXXXXX' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
      }
      updates.phone_number = normalized
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ success: false, error: '업데이트할 필드가 없습니다.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    const supabase = createServiceClient()
    const { error } = await (supabase as any)
      .from('profiles')
      .update(updates)
      .eq('id', userId)

    if (error) {
      console.error('admin/users PATCH: update error', error)
      return NextResponse.json({ success: false, error: '업데이트 실패' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }

    return NextResponse.json({ success: true, data: { plan: updates.plan, phoneMasked: maskKRPhone(updates.phone_number) } }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('admin/users PATCH error', e)
    return NextResponse.json({ success: false, error: '서버 오류' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
})


