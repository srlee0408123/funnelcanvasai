/**
 * workspace-service.ts - 워크스페이스 도메인 데이터 접근 레이어(DAL)
 */
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/database.types'

type WorkspaceRow = Database['public']['Tables']['workspaces']['Row']

export async function getUserWorkspaces(userId: string): Promise<Pick<WorkspaceRow, 'id' | 'name' | 'created_at' | 'updated_at'>[]> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('workspaces')
    .select('id, name, created_at, updated_at')
    .eq('owner_id', userId)
  if (error) {
    console.error('Error fetching user workspaces:', error)
    return []
  }
  return (data || []) as Pick<WorkspaceRow, 'id' | 'name' | 'created_at' | 'updated_at'>[]
}

export async function createWorkspace(userId: string, name: string): Promise<WorkspaceRow | null> {
  const supabase = createServiceClient()
  const { data: workspace, error } = await (supabase as any)
    .from('workspaces')
    .insert({ name, owner_id: userId })
    .select()
    .single()
  if (error) {
    console.error('Error creating workspace:', error)
    return null
  }
  // Add owner as member
  const { error: memberError } = await (supabase as any)
    .from('workspace_members')
    .insert({ workspace_id: (workspace as any).id, user_id: userId, role: 'owner' })
  if (memberError) {
    console.error('Error adding workspace member:', memberError)
  }
  return workspace as WorkspaceRow
}


