import { type NextRequest, NextResponse } from 'next/server'
import { withAuthorization } from '@/lib/auth/withAuthorization'

// GET /api/workspaces/[workspaceId]/role
const getWorkspaceRole = async (
  _req: NextRequest,
  { role }: { role?: any }
) => {
  return NextResponse.json({ role: role ?? null })
}

export const GET = withAuthorization({ resourceType: 'workspace' }, getWorkspaceRole)


