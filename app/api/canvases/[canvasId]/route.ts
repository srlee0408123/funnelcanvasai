/**
 * [canvasId]/route.ts - 캔버스 단건 조회 및 제목 수정 API
 * 
 * 주요 역할:
 * 1. GET: 캔버스 메타데이터 단건 조회(id로)
 * 2. PATCH: 캔버스 제목(title) 수정
 * 
 * 핵심 특징:
 * - 권한 검사 공통 처리(HOF) 적용
 * - 서버 사이드 Supabase 서비스 키로 안전한 DB 접근
 * - 명확한 에러 응답과 상태 코드 반환
 * 
 * 주의사항:
 * - PATCH는 최소 member 이상의 권한 필요
 * - GET은 접근 권한만 있으면 허용(최소 viewer)
 */

import { NextResponse } from 'next/server'
import { withAuthorization } from '@/lib/auth/withAuthorization'
import { createServiceClient } from '@/lib/supabase/service'
import { getCanvasById } from '@/services/canvas-service'

// GET /api/canvases/[canvasId]
const getCanvas = async (
  _req: Request,
  { params }: { params: any }
) => {
  try {
    const { canvasId } = await params
    const canvas = await getCanvasById(canvasId)
    if (!canvas) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 })
    }
    return NextResponse.json(canvas)
  } catch (error) {
    console.error('GET /api/canvases/[canvasId] error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// PATCH /api/canvases/[canvasId]
const patchCanvas = async (
  req: Request,
  { params }: { params: any }
) => {
  try {
    const { canvasId } = await params
    const body = await req.json().catch(() => ({}))

    const titleFromBody = typeof body?.title === 'string' ? body.title.trim() : ''
    if (!titleFromBody) {
      return NextResponse.json(
        { error: 'Invalid payload', details: 'title is required and must be a non-empty string' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const { data: updated, error: updateError } = await (supabase as any)
      .from('canvases')
      .update({ title: titleFromBody })
      .eq('id', canvasId)
      .select('*')
      .single()

    if (updateError) {
      console.error('Error updating canvas title:', updateError)
      return NextResponse.json(
        { error: 'Failed to update canvas' },
        { status: 500 }
      )
    }

    if (!updated) {
      return NextResponse.json({ error: 'Canvas not found' }, { status: 404 })
    }

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/canvases/[canvasId] error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const GET = withAuthorization({ resourceType: 'canvas' }, getCanvas)
export const PATCH = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, patchCanvas)

// DELETE /api/canvases/[canvasId]
const deleteCanvas = async (
  _req: Request,
  { params }: { params: any }
) => {
  try {
    const { canvasId } = await params

    const supabase = createServiceClient()
    const { error } = await (supabase as any)
      .from('canvases')
      .delete()
      .eq('id', canvasId)
      .select('id')
      .single()

    if (error) {
      // Row not found or deletion error
      const isNotFound = (error as any)?.code === 'PGRST116' || (error as any)?.code === 'PGRST204'
      if (isNotFound) {
        return NextResponse.json({ error: 'Canvas not found' }, { status: 404 })
      }
      console.error('Error deleting canvas:', error)
      return NextResponse.json({ error: 'Failed to delete canvas' }, { status: 500 })
    }

    // CASCADE constraints ensure related data is removed
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/canvases/[canvasId] error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const DELETE = withAuthorization({ resourceType: 'canvas', minRole: 'owner' }, deleteCanvas)

