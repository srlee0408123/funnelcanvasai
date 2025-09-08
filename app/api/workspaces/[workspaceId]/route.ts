/**
 * [workspaceId]/route.ts - 워크스페이스 단건 삭제 API
 *
 * 주요 역할:
 * 1. DELETE: 워크스페이스 삭제(소유자/관리자만)
 * 2. CASCADE 제약에 의해 연결된 캔버스/데이터 일괄 삭제
 *
 * 주의사항:
 * - 삭제는 파괴적 작업으로 복구 불가
 * - 서버 사이드에서만 호출
 */

import { NextResponse } from 'next/server'
import { withAuthorization } from '@/lib/auth/withAuthorization'
import { createServiceClient } from '@/lib/supabase/service'

// DELETE /api/workspaces/[workspaceId]
const deleteWorkspace = async (
  _req: Request,
  { params }: { params: any }
) => {
  try {
    const { workspaceId } = await params

    const supabase = createServiceClient()
    const { error } = await (supabase as any)
      .from('workspaces')
      .delete()
      .eq('id', workspaceId)
      .select('id')
      .single()

    if (error) {
      const isNotFound = (error as any)?.code === 'PGRST116' || (error as any)?.code === 'PGRST204'
      if (isNotFound) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
      }
      console.error('Error deleting workspace:', error)
      return NextResponse.json({ error: 'Failed to delete workspace' }, { status: 500 })
    }

    // CASCADE constraints ensure related canvases and data are removed
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/workspaces/[workspaceId] error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export const DELETE = withAuthorization({ resourceType: 'workspace', minRole: 'owner' }, deleteWorkspace)


