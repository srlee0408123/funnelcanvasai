/**
 * planLimits.ts - 무료/프로 플랜 제한 공통 유틸리티
 * 
 * 주요 역할:
 * 1. 사용자 플랜 조회 및 무료 플랜 여부 판단
 * 2. 리소스 생성/업로드/질문 등의 제한 조건 카운트 및 검사
 * 3. API 라우트에서 재사용 가능한 헬퍼 제공으로 중복 제거
 * 
 * 핵심 특징:
 * - Supabase Service 클라이언트로 RLS 우회하여 정확한 카운트 수행
 * - count 옵션(head:true) 우선 사용, 미지원 시 데이터 길이 fallback 가능
 * - 단일 책임 함수들로 구성되어 테스트/유지보수 용이
 * 
 * 주의사항:
 * - 서버 환경에서만 사용 (클라이언트에서 import 금지)
 * - 시간 계산(하루 기준)은 UTC 자정 기준으로 단순화
 */

import { createServiceClient } from '@/lib/supabase/service'

export type UserPlan = 'free' | 'pro'

export async function getUserPlan(userId: string): Promise<UserPlan> {
  const supabase = createServiceClient()
  const { data } = await (supabase as any)
    .from('profiles')
    .select('plan')
    .eq('id', userId)
    .maybeSingle()
  const plan = (data as any)?.plan as UserPlan | undefined
  return plan === 'pro' ? 'pro' : 'free'
}

export async function isFreePlan(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId)
  return plan === 'free'
}

export async function countOwnedWorkspaces(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await (supabase as any)
    .from('workspaces')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
  return typeof count === 'number' ? count : 0
}

export async function countCreatedCanvases(userId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await (supabase as any)
    .from('canvases')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', userId)
  return typeof count === 'number' ? count : 0
}

export async function getCanvasItemCounts(canvasId: string): Promise<{ nodesCount: number; memosCount: number; todosCount: number; total: number }> {
  const supabase = createServiceClient()
  // 최신 상태 조회하여 nodes 길이 계산
  const { data: stateRow } = await (supabase as any)
    .from('canvas_states')
    .select('state')
    .eq('canvas_id', canvasId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const rawState = (stateRow as any)?.state
  const nodesCount = Array.isArray(rawState?.nodes) ? rawState.nodes.length : 0

  // 메모/할일 카운트
  const [{ count: memosCount }, { count: todosCount }] = await Promise.all([
    (supabase as any).from('text_memos').select('id', { count: 'exact', head: true }).eq('canvas_id', canvasId),
    (supabase as any).from('canvas_todos').select('id', { count: 'exact', head: true }).eq('canvas_id', canvasId),
  ])

  const memos = typeof memosCount === 'number' ? memosCount : 0
  const todos = typeof todosCount === 'number' ? todosCount : 0
  const total = nodesCount + memos + todos
  return { nodesCount, memosCount: memos, todosCount: todos, total }
}

export function getTodayUtcStart(): string {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function countUserChatQuestionsToday(userId: string, canvasId?: string): Promise<number> {
  const supabase = createServiceClient()
  const since = getTodayUtcStart()
  let query = (supabase as any)
    .from('chat_messages')
    .select('id', { count: 'exact' })
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', since)
  if (canvasId) query = query.eq('canvas_id', canvasId)
  const { count } = await query
  return typeof count === 'number' ? count : 0
}

export async function countCanvasKnowledge(canvasId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await (supabase as any)
    .from('canvas_knowledge')
    .select('id', { count: 'exact', head: true })
    .eq('canvas_id', canvasId)
  return typeof count === 'number' ? count : 0
}

export async function countCanvasMemos(canvasId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await (supabase as any)
    .from('text_memos')
    .select('id', { count: 'exact', head: true })
    .eq('canvas_id', canvasId)
  return typeof count === 'number' ? count : 0
}

export async function countCanvasTodos(canvasId: string): Promise<number> {
  const supabase = createServiceClient()
  const { count } = await (supabase as any)
    .from('canvas_todos')
    .select('id', { count: 'exact', head: true })
    .eq('canvas_id', canvasId)
  return typeof count === 'number' ? count : 0
}


