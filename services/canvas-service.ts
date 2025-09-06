/**
 * canvas-service.ts - 캔버스 도메인 데이터 접근 레이어(DAL)
 * 
 * 주요 역할:
 * 1. 캔버스/상태/메모/채팅 등 캔버스 관련 DB 접근을 함수로 캡슐화
 * 2. API 라우트는 서비스 함수 호출과 요청/응답 처리에 집중
 * 3. 타입 안전(Database 타입 기반)과 에러 로깅 일관성 확보
 * 
 * 주의사항:
 * - 서버 사이드에서만 사용(서비스 로우 키)
 * - 에러는 콘솔 로깅 후 호출자에서 사용자 메시지로 변환
 */

import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/database.types'

export type Json = Database['public']['Enums'] extends never ? any : unknown
type CanvasRow = Database['public']['Tables']['canvases']['Row']
type CanvasStateRow = Database['public']['Tables']['canvas_states']['Row']

export async function getCanvasById(canvasId: string): Promise<CanvasRow | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('canvases')
    .select('*')
    .eq('id', canvasId)
    .single()
  if (error) {
    console.error('Error fetching canvas:', error)
    return null
  }
  return data as CanvasRow
}

export async function getLatestCanvasState(canvasId: string): Promise<CanvasStateRow | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('canvas_states')
    .select('*')
    .eq('canvas_id', canvasId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (error) {
    console.error('Error fetching latest canvas state:', error)
    return null
  }
  return data as CanvasStateRow
}

export async function insertCanvasState(canvasId: string, state: any, userId: string): Promise<CanvasStateRow | null> {
  const supabase = createServiceClient()
  const insertPayload = {
    canvas_id: canvasId,
    state,
    user_id: userId,
  } as Partial<CanvasStateRow>

  const { data, error } = await supabase
    .from('canvas_states')
    .insert(insertPayload as any)
    .select('*')
    .single()
  if (error) {
    console.error('Error inserting canvas state:', error)
    return null
  }
  return data as CanvasStateRow
}


