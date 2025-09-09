/**
 * Payments Status API - 회원권 결제 성공 여부 조회 (전화번호 매칭 기반)
 * 
 * 주요 역할:
 * 1. 현재 로그인 사용자의 프로필 전화번호 조회
 * 2. 결제 웹훅으로 저장된 payments 테이블에서 동일 전화번호 + SUCCESS + MEMBERSHIP_PAYMENT 내역 확인
 * 3. 프론트에서 토스트 노출 여부 판단을 위한 boolean 반환
 * 
 * 핵심 특징:
 * - 전화번호를 한국 표준(010으로 시작 11자리)으로 노멀라이즈하여 정확 매칭
 * - 서비스 키로 RLS 우회 읽기 전용 접근
 * - 간단한 boolean 응답으로 클라이언트 폴링 용이
 * 
 * 주의사항:
 * - 오래된 결제 성공 이력도 true가 될 수 있음(필요 시 기간 제한 추가 가능)
 * - 반드시 로그인 상태에서만 접근 가능
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { createServiceClient } from '@/lib/supabase/service'

function normalizeKRPhone(input: string): string {
  const digits = (input || '').replace(/\D/g, '')
  if (digits.startsWith('010')) return digits.slice(0, 11)
  if (digits.length === 8) return `010${digits}`
  return digits
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()
    if (!userId) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const supabase = createServiceClient()

    // Fetch profile phone and email
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('phone_number, email')
      .eq('id', userId)
      .maybeSingle()

    if (profileErr) {
      console.error('payments/status: profile fetch error', profileErr)
      return NextResponse.json({ success: false, error: 'Failed to load profile' }, { status: 500 })
    }

    const profilePhone = (profile as any)?.phone_number ? normalizeKRPhone(String((profile as any).phone_number)) : null
    const profileEmail = (profile as any)?.email || null

    // Find latest membership by phone first, then by email
    let payment: any = null
    let payErr: any = null
    if (profilePhone) {
      const { data, error } = await (supabase as any)
        .from('payments')
        .select('id, status, type, subscription_status, activated_at, current_period_start, current_period_end, next_renewal_at, cancel_at_period_end, canceled_at, scheduled_downgrade_processed, created_at')
        .eq('phone_number', profilePhone)
        .eq('type', 'MEMBERSHIP_PAYMENT')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      payment = data
      payErr = error
    }
    if (!payment && profileEmail) {
      const { data, error } = await (supabase as any)
        .from('payments')
        .select('id, status, type, subscription_status, activated_at, current_period_start, current_period_end, next_renewal_at, cancel_at_period_end, canceled_at, scheduled_downgrade_processed, created_at')
        .eq('email', profileEmail)
        .eq('type', 'MEMBERSHIP_PAYMENT')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      payment = data
      payErr = payErr || error
    }

    if (payErr) {
      console.error('payments/status: payments query error', payErr)
      // Graceful handling if payments table not present yet (e.g., migration not applied)
      if ((payErr as any)?.code === 'PGRST205') {
        return NextResponse.json({ success: false, reason: 'PAYMENTS_TABLE_MISSING' }, { status: 200 })
      }
      return NextResponse.json({ success: false, error: 'Failed to check payments' }, { status: 500 })
    }

    // Determine active membership window
    const now = new Date()
    const currentEnd = payment?.current_period_end ? new Date(payment.current_period_end) : null
    const isActiveSuccess = payment?.status === 'SUCCESS' && payment?.subscription_status === 'ACTIVE' && currentEnd && now < currentEnd
    const isActiveScheduledCancel = payment?.status === 'CANCEL' && payment?.subscription_status === 'CANCELED' && payment?.cancel_at_period_end === true && currentEnd && now < currentEnd && payment?.scheduled_downgrade_processed === false
    const isActive = Boolean(isActiveSuccess || isActiveScheduledCancel)

    return NextResponse.json({ success: isActive })
  } catch (e) {
    console.error('GET /api/payments/status error:', e)
    return NextResponse.json({ success: false, error: 'Unexpected error' }, { status: 500 })
  }
}


