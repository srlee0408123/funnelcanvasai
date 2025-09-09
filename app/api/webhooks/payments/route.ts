import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'

type WebhookType = 'NORMAL_PAYMENT' | 'MEMBERSHIP_PAYMENT'
type PaymentStatus = 'SUCCESS' | 'CANCEL'
type SubscriptionStatus = 'ACTIVE' | 'CANCELED' | 'PAST_DUE' | 'TRIALING' | 'UNPAID'

interface WebhookPaymentForm {
  question: string
  answer: string | boolean | number | null
}

interface WebhookPaymentAgreement {
  question: string
  answer: boolean
}

interface WebhookPaymentBody {
  type: WebhookType
  payment: {
    name?: string
    email: string
    phoneNumber?: string
    amount?: number
    status: PaymentStatus
    date?: string
    method?: string
    canceledReason?: string
    option?: string
    forms?: WebhookPaymentForm[]
    agreements?: WebhookPaymentAgreement[]
    // Subscription-related (optional)
    subscriptionId?: string
    subscriptionStatus?: SubscriptionStatus
    activatedAt?: string
    currentPeriodStart?: string
    currentPeriodEnd?: string
    nextRenewalAt?: string
    cancelAtPeriodEnd?: boolean
    canceledAt?: string
  }
}

function isValidBody(payload: any): payload is WebhookPaymentBody {
  if (!payload || typeof payload !== 'object') return false
  const { type, payment } = payload
  const validType = type === 'NORMAL_PAYMENT' || type === 'MEMBERSHIP_PAYMENT'
  const validPayment = payment && typeof payment === 'object'
  const validEmail = !!payment?.email && typeof payment.email === 'string'
  const validStatus = payment?.status === 'SUCCESS' || payment?.status === 'CANCEL'
  return Boolean(validType && validPayment && validEmail && validStatus)
}

function normalizeKRPhone(input: string | undefined | null): string | null {
  if (!input) return null
  const digits = String(input).replace(/\D/g, '')
  if (digits.startsWith('010')) return digits.slice(0, 11)
  if (digits.length === 8) return `010${digits}`
  return digits || null
}

function addMonths(dateIso: string, months: number): string {
  const d = new Date(dateIso)
  const year = d.getUTCFullYear()
  const month = d.getUTCMonth()
  const day = d.getUTCDate()
  const newDate = new Date(Date.UTC(year, month + months, 1))
  const lastDay = new Date(Date.UTC(newDate.getUTCFullYear(), newDate.getUTCMonth() + 1, 0)).getUTCDate()
  newDate.setUTCDate(Math.min(day, lastDay))
  // Preserve time (UTC) from original
  newDate.setUTCHours(d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds(), d.getUTCMilliseconds())
  return newDate.toISOString()
}

async function findLatestMembershipByIdentity(supabase: any, phone: string | null, email: string | null) {
  // Prefer phone match, then fall back to email if no phone record exists
  if (phone) {
    const { data, error } = await supabase
      .from('payments')
      .select('id, status, subscription_status, activated_at, current_period_start, current_period_end, next_renewal_at, cancel_at_period_end, canceled_at, created_at')
      .eq('type', 'MEMBERSHIP_PAYMENT')
      .eq('phone_number', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('findLatestMembershipByIdentity error (phone):', error)
    }
    if (data) return data
  }
  if (email) {
    const { data, error } = await supabase
      .from('payments')
      .select('id, status, subscription_status, activated_at, current_period_start, current_period_end, next_renewal_at, cancel_at_period_end, canceled_at, created_at')
      .eq('type', 'MEMBERSHIP_PAYMENT')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) {
      console.error('findLatestMembershipByIdentity error (email):', error)
    }
    return data
  }
  return null
}

export async function POST(request: NextRequest) {
  try {
    const userAgent = request.headers.get('user-agent') || undefined
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 })
    }

    const body = await request.json()
    console.log('body', body)
    if (!isValidBody(body)) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
    }

    const { type, payment } = body
    const supabase = createServiceClient()

    // Normalize values
    const normalizedDate = payment.date ? new Date(payment.date).toISOString() : null
    const normalizedActivatedAt = payment.activatedAt ? new Date(payment.activatedAt).toISOString() : null
    const normalizedCurrentPeriodStart = payment.currentPeriodStart ? new Date(payment.currentPeriodStart).toISOString() : null
    const normalizedCurrentPeriodEnd = payment.currentPeriodEnd ? new Date(payment.currentPeriodEnd).toISOString() : null
    const normalizedNextRenewalAt = payment.nextRenewalAt ? new Date(payment.nextRenewalAt).toISOString() : null
    const normalizedCanceledAt = payment.canceledAt ? new Date(payment.canceledAt).toISOString() : null

    // Normalize phone for consistent matching with profile
    const normalizedPhone = normalizeKRPhone(payment.phoneNumber)

    // MEMBERSHIP_PAYMENT: update-first strategy, compute periods, cancel always schedules downgrade at period end
    if (type === 'MEMBERSHIP_PAYMENT') {
      const isSuccess = payment.status === 'SUCCESS'
      const isCancel = payment.status === 'CANCEL'

      // Resolve profile by phoneNumber first, then email as fallback
      let profile: { id: string; email?: string } | null = null
      let profileErr: any = null

      if (normalizedPhone) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('phone_number', normalizedPhone)
          .maybeSingle()
        profile = data as any
        profileErr = error
      }
      if (!profile && payment.email) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', payment.email)
          .maybeSingle()
        profile = data as any
        profileErr = profileErr || error
      }

      if (profileErr) {
        console.error('Profile lookup error:', profileErr)
      }

      // Load latest membership record for upsert/update
      const latest = await findLatestMembershipByIdentity(supabase, normalizedPhone, payment.email)

      if (isSuccess) {
        const periodStart = normalizedDate || new Date().toISOString()
        const periodEnd = addMonths(periodStart, 1)
        const updatePayload: Record<string, any> = {
          type,
          name: payment.name ?? null,
          email: payment.email,
          phone_number: normalizedPhone,
          amount: typeof payment.amount === 'number' ? payment.amount : null,
          status: 'SUCCESS',
          subscription_status: 'ACTIVE',
          date: periodStart,
          method: payment.method ?? null,
          canceled_reason: null,
          option: payment.option ?? null,
          subscription_id: payment.subscriptionId ?? null,
          activated_at: periodStart,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          next_renewal_at: periodEnd,
          cancel_at_period_end: false,
          canceled_at: null,
          scheduled_downgrade_at: null,
          scheduled_downgrade_processed: false,
          forms: payment.forms ?? null,
          agreements: payment.agreements ?? null,
          user_agent: userAgent ?? null,
          raw: body,
          updated_at: new Date().toISOString(),
        }

        let savedId: string | undefined
        if (latest?.id) {
          const { data: updated, error: upErr } = await (supabase as any)
            .from('payments')
            .update(updatePayload)
            .eq('id', latest.id)
            .select('id')
            .single()
          if (upErr) {
            console.error('Membership update error:', upErr)
            return NextResponse.json({ error: 'Failed to update membership payment' }, { status: 500 })
          }
          savedId = updated?.id
        } else {
          const { data: inserted, error: insErr } = await (supabase as any)
            .from('payments')
            .insert(updatePayload)
            .select('id')
            .single()
          if (insErr) {
            console.error('Membership insert error:', insErr)
            return NextResponse.json({ error: 'Failed to record membership payment' }, { status: 500 })
          }
          savedId = inserted?.id
        }

        // Upgrade plans for the owner (profile + all owned workspaces)
        if (profile?.id) {
          const [{ error: profErr }, { error: wsErr }] = await Promise.all([
            (supabase as any).from('profiles').update({ plan: 'pro' }).eq('id', profile.id),
            (supabase as any).from('workspaces').update({ plan: 'pro' }).eq('owner_id', profile.id),
          ])
          if (profErr) console.error('Profile plan update error (SUCCESS):', profErr)
          if (wsErr) console.error('Workspace plan update error (SUCCESS):', wsErr)
        } else {
          console.warn('No profile found for phone/email; plan not updated on SUCCESS:', { phoneNumber: payment.phoneNumber, email: payment.email })
        }

        return NextResponse.json({ ok: true, id: savedId })
      }

      if (isCancel) {
        const cancelDate = normalizedDate || new Date().toISOString()
        const activatedAt = latest?.activated_at || latest?.current_period_start || null
        // Determine schedule target for cancellation (always end of current period)
        const currentEnd = latest?.current_period_end || (activatedAt ? addMonths(activatedAt, 1) : null)
        const updatePayload: Record<string, any> = {
          type,
          name: payment.name ?? null,
          email: payment.email,
          phone_number: normalizedPhone,
          amount: typeof payment.amount === 'number' ? payment.amount : null,
          status: 'CANCEL',
          subscription_status: 'CANCELED',
          date: cancelDate,
          method: payment.method ?? null,
          canceled_reason: payment.canceledReason ?? null,
          option: payment.option ?? null,
          subscription_id: payment.subscriptionId ?? null,
          // Keep existing activation/period fields if present
          activated_at: activatedAt,
          current_period_start: latest?.current_period_start || activatedAt,
          current_period_end: latest?.current_period_end || currentEnd,
          next_renewal_at: latest?.next_renewal_at || currentEnd,
          cancel_at_period_end: true,
          canceled_at: cancelDate,
          scheduled_downgrade_at: currentEnd,
          scheduled_downgrade_processed: false,
          forms: payment.forms ?? null,
          agreements: payment.agreements ?? null,
          user_agent: userAgent ?? null,
          raw: body,
          updated_at: new Date().toISOString(),
        }

        let savedId: string | undefined
        if (latest?.id) {
          const { data: updated, error: upErr } = await (supabase as any)
            .from('payments')
            .update(updatePayload)
            .eq('id', latest.id)
            .select('id')
            .single()
          if (upErr) {
            console.error('Membership cancel update error:', upErr)
            return NextResponse.json({ error: 'Failed to update cancellation' }, { status: 500 })
          }
          savedId = updated?.id
        } else {
          const { data: inserted, error: insErr } = await (supabase as any)
            .from('payments')
            .insert(updatePayload)
            .select('id')
            .single()
          if (insErr) {
            console.error('Membership cancel insert error:', insErr)
            return NextResponse.json({ error: 'Failed to record cancellation' }, { status: 500 })
          }
          savedId = inserted?.id
        }

        if (!profile?.id) {
          console.warn('No profile found for phone/email; plan not updated on CANCEL:', { phoneNumber: payment.phoneNumber, email: payment.email })
        }

        return NextResponse.json({ ok: true, id: savedId })
      }
    }

    // Non-membership payments: store as-is (append-only)
    const insertPayload = {
      type,
      name: payment.name ?? null,
      email: payment.email,
      phone_number: normalizedPhone,
      amount: typeof payment.amount === 'number' ? payment.amount : null,
      status: payment.status,
      date: normalizedDate,
      method: payment.method ?? null,
      canceled_reason: payment.canceledReason ?? null,
      option: payment.option ?? null,
      // Subscription-related
      subscription_id: payment.subscriptionId ?? null,
      subscription_status: payment.subscriptionStatus ?? null,
      activated_at: normalizedActivatedAt,
      current_period_start: normalizedCurrentPeriodStart,
      current_period_end: normalizedCurrentPeriodEnd,
      next_renewal_at: normalizedNextRenewalAt,
      cancel_at_period_end: typeof payment.cancelAtPeriodEnd === 'boolean' ? payment.cancelAtPeriodEnd : null,
      canceled_at: normalizedCanceledAt,
      forms: payment.forms ?? null,
      agreements: payment.agreements ?? null,
      user_agent: userAgent ?? null,
      raw: body
    }
    const { data: saved, error: insertError } = await (supabase as any)
      .from('payments')
      .insert(insertPayload)
      .select('id')
      .single()

    if (insertError) {
      console.error('Payment insert error:', insertError)
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, id: saved?.id })
  } catch (error) {
    console.error('Payments webhook error:', error)
    return NextResponse.json(
      { error: 'Unexpected server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}

export async function GET() {
  // Optional: simple health check endpoint
  return NextResponse.json({ ok: true })
}
