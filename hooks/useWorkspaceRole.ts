import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./useAuth";

export interface WorkspacePermissions {
  canInviteMembers: boolean;
  canManageMembers: boolean;
  canEditCanvas: boolean;
  canDeleteCanvas: boolean;
  canManageAssets: boolean;
  canViewMembers: boolean;
}

export function useWorkspaceRole(workspaceId: string) {
  const { user } = useAuth();

  const { data: role, isLoading } = useQuery({
    queryKey: ['workspace-role', workspaceId, user?.id],
    queryFn: async () => {
      if (!workspaceId || !user?.id) return null;
      
      const response = await fetch(`/api/workspaces/${workspaceId}/role`, {
        credentials: 'include'
      });
      
      if (!response.ok) return null;
      const data = await response.json();
      return data.role;
    },
    enabled: !!workspaceId && !!user?.id
  });

  const getPermissions = (userRole: string): WorkspacePermissions => {
    switch (userRole) {
      case 'owner':
        return {
          canInviteMembers: true,
          canManageMembers: true,
          canEditCanvas: true,
          canDeleteCanvas: true,
          canManageAssets: true,
          canViewMembers: true,
        };
      case 'admin':
        return {
          canInviteMembers: true,
          canManageMembers: true,
          canEditCanvas: true,
          canDeleteCanvas: false,
          canManageAssets: true,
          canViewMembers: true,
        };
      case 'editor':
        return {
          canInviteMembers: false,
          canManageMembers: false,
          canEditCanvas: true,
          canDeleteCanvas: false,
          canManageAssets: true,
          canViewMembers: true,
        };
      case 'viewer':
        return {
          canInviteMembers: false,
          canManageMembers: false,
          canEditCanvas: false,
          canDeleteCanvas: false,
          canManageAssets: false,
          canViewMembers: true,
        };
      default:
        return {
          canInviteMembers: false,
          canManageMembers: false,
          canEditCanvas: false,
          canDeleteCanvas: false,
          canManageAssets: false,
          canViewMembers: false,
        };
    }
  };

  const permissions = role ? getPermissions(role) : getPermissions('');

  return {
    role,
    permissions,
    isLoading,
    isOwner: role === 'owner',
    isAdmin: role === 'admin',
    isEditor: role === 'editor',
    isViewer: role === 'viewer',
  };
}