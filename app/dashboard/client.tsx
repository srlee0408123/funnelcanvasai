"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Ui/layout";
import { Button } from "@/components/Ui/buttons";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/Ui/data-display";
import { Input, Label } from "@/components/Ui/form-controls";
import { useToast } from "@/hooks/use-toast";
import { ProfileBadge } from "@/components/Canvas/CanvasHeader";
import { useProfile } from "@/hooks/useAuth";
import { queryClient } from "@/lib/queryClient";
import { createToastMessage } from "@/lib/messages/toast-utils";
import { FolderOpen, Users, Calendar, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";

interface DashboardClientProps {
  userId: string;
}

export default function DashboardClient({ userId }: DashboardClientProps) {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);

  // 프로필 정보 가져오기
  const { profile } = useProfile();

  // Fetch workspaces directly from Supabase for real-time updates
  const { data: workspaces, isLoading: workspacesLoading } = useQuery<Database['public']['Tables']['workspaces']['Row'][]>({
    queryKey: ["workspaces", userId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching workspaces:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!userId,
    refetchInterval: false,
  });

  // Sync user to Supabase when component mounts
  useEffect(() => {
    const syncUser = async () => {
      if (userId) {
        try {
          const response = await fetch('/api/sync-user', { method: 'POST' });
          if (!response.ok) {
            console.error('Failed to sync user');
          } else {
            console.log('User synced successfully');
            queryClient.invalidateQueries({ queryKey: ["workspaces"] });
          }
        } catch (error) {
          console.error('Error syncing user:', error);
        }
      }
    };
    
    syncUser();
  }, [userId]);

  // Setup Supabase realtime subscription for workspaces
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    console.log('Setting up realtime subscription for user:', userId);
    
    // Subscribe to workspace changes
    const workspaceChannel = supabase
      .channel('workspaces-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'workspaces',
          filter: `owner_id=eq.${userId}`
        },
        (payload) => {
          console.log('Workspace change received:', payload);
          queryClient.invalidateQueries({ queryKey: ["workspaces"] });
        }
      )
      .subscribe((status) => {
        console.log('Workspace subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to workspace changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to workspace changes');
        } else if (status === 'TIMED_OUT') {
          console.error('Subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('Channel closed');
        }
      });

    // Test the connection
    console.log('Channel state:', workspaceChannel);

    // Cleanup subscriptions on unmount
    return () => {
      console.log('Cleaning up workspace subscription');
      supabase.removeChannel(workspaceChannel);
    };
  }, [userId]);

  // Create workspace mutation
  const createWorkspaceMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) throw new Error('Failed to create workspace');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setShowWorkspaceDialog(false);
      setNewWorkspaceName("");
      const successMessage = createToastMessage.custom("워크스페이스 생성 완료", "새 워크스페이스가 생성되었습니다.", "default");
      toast(successMessage);
    },
    onError: (error) => {
      const errorMessage = createToastMessage.custom("워크스페이스 생성 실패", "워크스페이스 생성에 실패했습니다.", "destructive", "다시 시도해주세요");
      toast(errorMessage);
    },
  });

  // Delete workspace mutation
  const deleteWorkspaceMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      await apiRequest("DELETE", `/api/workspaces/${workspaceId}`);
      return workspaceId;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspaces", userId] });
      const successMessage = createToastMessage.custom("워크스페이스 삭제 완료", "워크스페이스가 삭제되었습니다.", "default");
      toast(successMessage);
    },
    onError: (error) => {
      console.error('Failed to delete workspace:', error);
      const errorMessage = createToastMessage.custom("워크스페이스 삭제 실패", "삭제 중 문제가 발생했습니다.", "destructive", "다시 시도해주세요");
      toast(errorMessage);
    },
  });

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Canvas AI</h1>
                <p className="text-sm text-gray-600">Workspaces</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ProfileBadge profile={profile} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">My Workspaces</h2>
          <Dialog open={showWorkspaceDialog} onOpenChange={setShowWorkspaceDialog}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="workspace-name">Workspace Name</Label>
                  <Input
                    id="workspace-name"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="e.g., Marketing Team"
                  />
                </div>
                <Button 
                  variant="secondary"
                  onClick={() => createWorkspaceMutation.mutate(newWorkspaceName)}
                  disabled={!newWorkspaceName || createWorkspaceMutation.isPending}
                  className="w-full"
                >
                  {createWorkspaceMutation.isPending ? "Creating..." : "Create Workspace"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {workspacesLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : workspaces && workspaces.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <FolderOpen className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No workspaces yet
            </h3>
            <p className="text-gray-600 mb-4">
              Create your first workspace to start organizing your funnels
            </p>
            <Button variant="secondary" onClick={() => setShowWorkspaceDialog(true)}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create First Workspace
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workspaces?.map((workspace) => (
              <Card
                key={workspace.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => router.push(`/workspace/${workspace.id}`)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{workspace.name}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`"${workspace.name}" 워크스페이스를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
                          deleteWorkspaceMutation.mutate(workspace.id);
                        }
                      }}
                      aria-label="Delete Workspace"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-2" />
                      Created: {new Date(workspace.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      Owner: You
                    </div>
                  </div>
                  <Button 
                    variant="secondary"
                    className="w-full mt-4"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/workspace/${workspace.id}`);
                    }}
                  >
                    Open Workspace
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}