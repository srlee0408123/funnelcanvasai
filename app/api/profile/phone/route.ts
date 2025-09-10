import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

function normalizeKRPhone(input: string): string {
  const digits = (input || '').replace(/\D/g, '')
  if (digits.startsWith('010')) return digits.slice(0, 11)
  if (digits.length === 8) return `010${digits}`
  return digits
}

function isValidKRPhone(digitsOnly: string): boolean {
  return /^010\d{8}$/.test(digitsOnly)
}

function maskKRPhone(digitsOnly: string | null): string | null {
  if (!digitsOnly) return null
  const d = normalizeKRPhone(digitsOnly)
  if (d.length < 7) return null
  return `010********`
}

function maskEmail(email: string | null): string | null {
  if (!email) return null
  const [local, domain] = email.split('@')
  if (!local || !domain) return null
  const visible = local.slice(0, 1)
  return `${visible}${'*'.repeat(local.length - 1)}@${domain}`
}

export async function GET() {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('phone_number, plan, email')
      .eq('id', userId)
      .maybeSingle()
    if (error) {
      console.error('Fetch phone error:', error)
      return NextResponse.json({ error: 'Failed to fetch phone' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
    const normalized = (data as any)?.phone_number ? normalizeKRPhone(String((data as any).phone_number)) : null
    const maskedPhone = maskKRPhone(normalized)
    const maskedEmail = maskEmail((data as any)?.email || null)
    return NextResponse.json({
      hasPhone: Boolean(normalized),
      phoneMasked: maskedPhone,
      plan: (data as any)?.plan || 'free',
      emailMasked: maskedEmail,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('GET /api/profile/phone error:', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })

    const body = await request.json().catch(() => null)
    const raw = body?.phoneNumber as string | undefined
    const normalized = normalizeKRPhone(raw || '')
    if (!isValidKRPhone(normalized)) {
      return NextResponse.json({ error: 'Invalid phone format. Expected 010XXXXXXXX' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('profiles')
      .update({ phone_number: normalized, updated_at: new Date().toISOString() })
      .eq('id', userId)
    if (error) {
      console.error('Update phone error:', error)
      return NextResponse.json({ error: 'Failed to update phone' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    }
    // Do not echo back raw phone number
    return NextResponse.json({ ok: true, phoneMasked: maskKRPhone(normalized) }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    console.error('POST /api/profile/phone error:', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
