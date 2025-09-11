import { NextResponse } from 'next/server'
import { withAdmin } from '@/lib/auth/withAuthorization'
import { createServiceClient } from '@/lib/supabase/service'

type MembershipSummary = {
  status: string | null
  current_period_start: string | null
  current_period_end: string | null
  next_renewal_at: string | null
}

function normalizeKRPhone(input: string | null | undefined): string | null {
  if (!input) return null
  const digits = String(input).replace(/\D/g, '')
  if (digits.length === 8) return `010${digits}`
  if (digits.startsWith('010')) return digits.slice(0, 11)
  return digits || null
}

function maskKRPhone(input: string | null | undefined): string | null {
  const normalized = normalizeKRPhone(input)
  if (!normalized) return null
  return '010********'
}

export const GET = withAdmin(async (req) => {
  try {
    const supabase = createServiceClient()

    const { data: profiles, error: profilesErr } = await (supabase as any)
      .from('profiles')
      .select('id, email, phone_number, plan, created_at')

    if (profilesErr) {
      console.error('admin/users GET: profiles error', profilesErr)
      return NextResponse.json({ success: false, error: '프로필 조회 실패' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }

    const profileIds = (profiles || []).map((p: any) => p.id)

    const phones = Array.from(new Set((profiles || [])
      .map((p: any) => normalizeKRPhone(p.phone_number))
      .filter((v: string | null): v is string => Boolean(v))))
    const emails = Array.from(new Set((profiles || [])
      .map((p: any) => (p.email ? String(p.email) : null))
      .filter((v: string | null): v is string => Boolean(v))))

    const [payByPhoneRes, payByEmailRes, payByProfileRes] = await Promise.all([
      phones.length > 0
        ? (supabase as any)
            .from('payments')
            .select('id, email, phone_number, type, subscription_status, activated_at, current_period_start, current_period_end, next_renewal_at, cancel_at_period_end, canceled_at, scheduled_downgrade_processed, created_at')
            .in('phone_number', phones)
            .eq('type', 'MEMBERSHIP_PAYMENT')
        : Promise.resolve({ data: [] as any[], error: null }),
      emails.length > 0
        ? (supabase as any)
            .from('payments')
            .select('id, email, phone_number, type, subscription_status, activated_at, current_period_start, current_period_end, next_renewal_at, cancel_at_period_end, canceled_at, scheduled_downgrade_processed, created_at')
            .in('email', emails)
            .eq('type', 'MEMBERSHIP_PAYMENT')
        : Promise.resolve({ data: [] as any[], error: null }),
      profileIds.length > 0
        ? (supabase as any)
            .from('v_payments_with_profile')
            .select('profile_id, type, subscription_status, current_period_start, current_period_end, next_renewal_at, created_at')
            .in('profile_id', profileIds)
            .eq('type', 'MEMBERSHIP_PAYMENT')
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [] as any[], error: null })
    ])

    const payByPhone = (payByPhoneRes as any).data as any[]
    const payByEmail = (payByEmailRes as any).data as any[]
    const payByProfile = (payByProfileRes as any).data as any[]

    const latestByPhone = new Map<string, any>()
    for (const row of payByPhone || []) {
      const key = normalizeKRPhone(row.phone_number)
      if (!key) continue
      const current = latestByPhone.get(key)
      if (!current || new Date(row.created_at).getTime() > new Date(current.created_at).getTime()) {
        latestByPhone.set(key, row)
      }
    }
    const latestByEmail = new Map<string, any>()
    for (const row of payByEmail || []) {
      const key = row.email ? String(row.email) : null
      if (!key) continue
      const current = latestByEmail.get(key)
      if (!current || new Date(row.created_at).getTime() > new Date(current.created_at).getTime()) {
        latestByEmail.set(key, row)
      }
    }

    // Profile-based latest map via DB view (preferred)
    const latestByProfile = new Map<string, any>()
    for (const row of payByProfile || []) {
      const pid = String(row.profile_id)
      if (!pid) continue
      if (!latestByProfile.has(pid)) {
        latestByProfile.set(pid, row)
      }
    }

    const result = (profiles || []).map((p: any) => {
      const phoneNorm = normalizeKRPhone(p.phone_number)
      let payment: any = latestByProfile.get(p.id) || null
      if (!payment) {
        if (phoneNorm && latestByPhone.has(phoneNorm)) {
          payment = latestByPhone.get(phoneNorm)
        } else if (p.email && latestByEmail.has(String(p.email))) {
          payment = latestByEmail.get(String(p.email))
        }
      }

      const membership: MembershipSummary = {
        status: payment?.subscription_status || null,
        current_period_start: payment?.current_period_start || null,
        current_period_end: payment?.current_period_end || null,
        next_renewal_at: payment?.next_renewal_at || payment?.current_period_end || null,
      }

      return {
        id: p.id,
        email: p.email,
        phoneMasked: maskKRPhone(phoneNorm),
        plan: p.plan || 'free',
        createdAt: p.created_at,
        membership,
      }
    })

    // Filtering by email(query) and plan
    const url = new URL(req.url)
    const q = (url.searchParams.get('q') || '').trim().toLowerCase()
    const planFilter = (url.searchParams.get('plan') || 'all').toLowerCase()

    const filtered = result.filter((row: any) => {
      const byQ = q ? String(row.email || '').toLowerCase().includes(q) : true
      const byPlan = planFilter === 'all' ? true : String(row.plan).toLowerCase() === planFilter
      return byQ && byPlan
    })
    // Stable ordering by createdAt desc to ensure consistent pagination
    filtered.sort((a: any, b: any) => {
      const at = a.createdAt ? new Date(a.createdAt).getTime() : 0
      const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0
      return bt - at
    })

    // Pagination (max 10 per page)
    const limitParam = Number(url.searchParams.get('limit') || 10)
    const limit = Math.max(1, Math.min(10, Number.isFinite(limitParam) ? limitParam : 10))
    const pageParam = Number(url.searchParams.get('page') || 1)
    let page = Math.max(1, Number.isFinite(pageParam) ? pageParam : 1)
    const total = filtered.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    if (page > totalPages) page = totalPages
    const start = (page - 1) * limit
    const data = filtered.slice(start, start + limit)

    return NextResponse.json({ success: true, data, page, limit, total, totalPages }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('admin/users GET error', error)
    return NextResponse.json({ success: false, error: '사용자 목록 조회 실패' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
})


