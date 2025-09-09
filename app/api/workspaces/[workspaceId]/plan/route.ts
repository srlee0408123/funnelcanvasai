import { type NextRequest, NextResponse } from 'next/server'
import { withAuthorization } from '@/lib/auth/withAuthorization'
import { createServiceClient } from '@/lib/supabase/service'

// GET /api/workspaces/[workspaceId]/plan
const getWorkspacePlan = async (
  _req: NextRequest,
  { params }: { params: { workspaceId: string } }
) => {
  const supabase = createServiceClient()
  const { data, error } = await (supabase as any)
    .from('workspaces')
    .select('plan')
    .eq('id', params.workspaceId)
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch plan' }, { status: 500 })
  }

  return NextResponse.json({ plan: (data as any)?.plan ?? 'free' })
}

export const GET = withAuthorization({ resourceType: 'workspace' }, getWorkspacePlan)


