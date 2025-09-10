/**
 * ragPromptService.ts - RAG 프롬프트 서버 서비스 (보안: 서비스 로우 전용)
 * 
 * 주요 역할:
 * 1. 최소 스키마 rag_prompts 테이블 CRUD 제공
 * 2. 활성 프롬프트 조회(getActiveInstruction)
 * 3. 관리자 API 라우트에서만 사용(서비스 로우 키 필수)
 * 
 * 핵심 특징:
 * - RLS 활성 + 정책 미정의: 기본적으로 서비스 로우만 접근 가능
 * - content는 TEXT로 저장, 민감 정보는 서버에서만 취급
 * - updated_at 트리거로 수정 시간 자동 관리
 */

import { createServiceClient } from '@/lib/supabase/service'

export type RagPrompt = {
  id: string
  name: string
  content: string
  is_active: boolean
  version: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export class RagPromptService {
  private readonly supabase = createServiceClient()

  /** 활성 프롬프트의 content만 반환 (없으면 빈 문자열) */
  async getActiveInstruction(): Promise<string> {
    const { data, error } = await (this.supabase as any)
      .from('rag_prompts')
      .select('content')
      .eq('is_active', true)
      .order('updated_at', { ascending: false })
      .limit(1)
    if (error) {
      console.error('Failed to load active rag prompt:', error)
      return ''
    }
    const content = Array.isArray(data) && data[0]?.content ? String(data[0].content) : ''
    return content
  }

  /** 목록 조회 (관리자용) */
  async list(): Promise<RagPrompt[]> {
    const { data, error } = await (this.supabase as any)
      .from('rag_prompts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map((d: any) => ({
      id: String(d.id),
      name: String(d.name),
      content: String(d.content),
      is_active: Boolean(d.is_active),
      version: Number(d.version || 1),
      created_by: d.created_by ? String(d.created_by) : null,
      created_at: String(d.created_at),
      updated_at: String(d.updated_at),
    }))
  }

  /** 생성 (관리자용) */
  async create(params: { name: string; content: string; is_active?: boolean; version?: number; created_by?: string; }): Promise<RagPrompt> {
    const payload = {
      name: params.name,
      content: params.content,
      is_active: params.is_active ?? true,
      version: params.version ?? 1,
      created_by: params.created_by ?? null,
    }
    const { data, error } = await (this.supabase as any)
      .from('rag_prompts')
      .insert(payload)
      .select('*')
      .single()
    if (error) throw error
    return {
      id: String(data.id),
      name: String(data.name),
      content: String(data.content),
      is_active: Boolean(data.is_active),
      version: Number(data.version || 1),
      created_by: data.created_by ? String(data.created_by) : null,
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
    }
  }

  /** 업데이트 (관리자용) */
  async update(
    id: string,
    params: Partial<Pick<RagPrompt, 'name' | 'content' | 'version'>>,
    changedBy?: string
  ): Promise<RagPrompt> {
    // 이전 값 조회 (로그용)
    const { data: before } = await (this.supabase as any)
      .from('rag_prompts')
      .select('*')
      .eq('id', id)
      .single()

    // 항상 활성 상태 유지
    const updateParams: any = { ...params, is_active: true }

    const { data, error } = await (this.supabase as any)
      .from('rag_prompts')
      .update(updateParams)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error

    // 변경 로그 적재 (append-only)
    try {
      await (this.supabase as any)
        .from('rag_prompt_logs')
        .insert({
          prompt_id: id,
          name_before: before?.name ?? null,
          name_after: data?.name ?? null,
          content_before: before?.content ?? null,
          content_after: data?.content ?? null,
          is_active_before: typeof before?.is_active === 'boolean' ? before.is_active : null,
          is_active_after: typeof data?.is_active === 'boolean' ? data.is_active : null,
          version_before: typeof before?.version === 'number' ? before.version : null,
          version_after: typeof data?.version === 'number' ? data.version : null,
          changed_by: changedBy ?? null,
        })
    } catch (e) {
      console.warn('Failed to write rag_prompt_logs:', e)
    }
    return {
      id: String(data.id),
      name: String(data.name),
      content: String(data.content),
      is_active: Boolean(data.is_active),
      version: Number(data.version || 1),
      created_by: data.created_by ? String(data.created_by) : null,
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
    }
  }

  /** 삭제 (관리자용) */
  async remove(id: string): Promise<void> {
    const { error } = await (this.supabase as any)
      .from('rag_prompts')
      .delete()
      .eq('id', id)
    if (error) throw error
  }

  /** 로그 조회 (최신 10개) */
  async listLogs(promptId: string, limit: number = 10): Promise<any[]> {
    const { data, error } = await (this.supabase as any)
      .from('rag_prompt_logs')
      .select('id, prompt_id, name_before, name_after, content_before, content_after, is_active_before, is_active_after, version_before, version_after, changed_by, changed_at')
      .eq('prompt_id', promptId)
      .order('changed_at', { ascending: false })
      .limit(Math.max(1, Math.min(50, limit)))
    if (error) throw error
    return data || []
  }
}

export const ragPromptService = new RagPromptService()


