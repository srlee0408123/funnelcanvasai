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
import { CanvasShareModal } from "@/components/Modals/CanvasShareModal";
import { ProfileBadge } from "@/components/Canvas/CanvasHeader";
import { useProfile } from "@/hooks/useAuth";
import { Share, ArrowLeft, FileText, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/database.types";
import { useCanvasRole } from "@/hooks/useCanvasRole";

interface WorkspaceClientProps {
  workspaceId: string;
  userId: string;
}

// 단일 캔버스 카드 컴포넌트: 캔버스별 권한에 따라 삭제 버튼 노출
function CanvasCardItem({ 
  canvas, 
  onShare, 
  onDelete 
}: { 
  canvas: Database['public']['Tables']['canvases']['Row']; 
  onShare: () => void; 
  onDelete: () => void; 
}) {
  const { isOwner } = useCanvasRole(canvas.id as unknown as string);
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{canvas.title}</CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => { e.preventDefault(); onShare(); }}
              aria-label="Share Canvas"
              title="Share"
            >
              <Share className="h-4 w-4" />
            </Button>
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => { e.preventDefault(); onDelete(); }}
                aria-label="Delete Canvas"
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-gray-600 mb-4">
          <div className="flex items-center mb-1">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date((canvas as any).created_at).toLocaleDateString()}
          </div>
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {new Date((canvas as any).updated_at).toLocaleDateString()}
          </div>
        </div>
        <Link href={`/canvas/${canvas.id}`}>
          <Button variant="secondary" className="w-full">
            Open Canvas
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}

export default function WorkspaceClient({ workspaceId, userId }: WorkspaceClientProps) {
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [newCanvasTitle, setNewCanvasTitle] = useState("");
  const [showCanvasDialog, setShowCanvasDialog] = useState(false);
  const [shareCanvas, setShareCanvas] = useState<Database['public']['Tables']['canvases']['Row'] | null>(null);

  // 프로필 정보 가져오기
  const { profile } = useProfile();

  // Fetch workspace details
  const { data: workspace, isLoading: workspaceLoading } = useQuery<Pick<Database['public']['Tables']['workspaces']['Row'], 'id' | 'name' | 'created_at' | 'updated_at'>>({
    queryKey: ["workspace", workspaceId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workspaces')
        .select('id, name, created_at, updated_at')
        .eq('id', workspaceId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!workspaceId,
  });

  // Fetch canvases for this workspace
  const { data: canvases = [], isLoading: canvasesLoading } = useQuery<Database['public']['Tables']['canvases']['Row'][]>({
    queryKey: ["canvases", workspaceId],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('canvases')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!workspaceId,
  });

  // Setup realtime subscription for canvases
  useEffect(() => {
    if (!workspaceId) return;

    const supabase = createClient();
    console.log('Setting up canvas realtime subscription for workspace:', workspaceId);
    
    const canvasChannel = supabase
      .channel('workspace-canvases')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'canvases',
          filter: `workspace_id=eq.${workspaceId}`
        },
        (payload) => {
          console.log('Canvas change received:', payload);
          queryClient.invalidateQueries({ queryKey: ["canvases", workspaceId] });
        }
      )
      .subscribe((status) => {
        console.log('Canvas subscription status:', status);
        if (status === 'SUBSCRIBED') {
          console.log('Successfully subscribed to canvas changes');
        } else if (status === 'CHANNEL_ERROR') {
          console.error('Failed to subscribe to canvas changes');
        } else if (status === 'TIMED_OUT') {
          console.error('Canvas subscription timed out');
        } else if (status === 'CLOSED') {
          console.log('Canvas channel closed');
        }
      });

    return () => {
      console.log('Cleaning up canvas subscription');
      supabase.removeChannel(canvasChannel);
    };
  }, [workspaceId]);

  // Create canvas mutation
  const createCanvasMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await fetch('/api/canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, workspace_id: workspaceId }),
        credentials: 'include',
      });
      const text = await response.text();
      if (!response.ok) {
        try {
          const data = JSON.parse(text);
          throw new Error(data?.error || text || '캔버스 생성에 실패했습니다.');
        } catch {
          throw new Error(text || '캔버스 생성에 실패했습니다.');
        }
      }
      try {
        return JSON.parse(text);
      } catch {
        return {} as any;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["canvases", workspaceId] });
      setShowCanvasDialog(false);
      setNewCanvasTitle("");
      toast({ title: "캔버스가 생성되었습니다." });
    },
    onError: (error: unknown) => {
      const raw = error instanceof Error ? error.message : String(error || '캔버스 생성에 실패했습니다.');
      let message = raw || '캔버스 생성에 실패했습니다.';
      // 에러 메시지에 JSON이 포함된 경우 파싱하여 사람이 읽기 쉬운 문구만 표시
      try {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          const jsonText = raw.slice(start, end + 1);
          const obj = JSON.parse(jsonText);
          message = obj?.error || obj?.message || message;
        }
      } catch {}
      toast({ 
        title: "오류", 
        description: message, 
        variant: "destructive" 
      });
    },
  });

  // Delete canvas mutation
  const deleteCanvasMutation = useMutation({
    mutationFn: async (canvasId: string) => {
      await apiRequest("DELETE", `/api/canvases/${canvasId}`);
      return canvasId;
    },
    onSuccess: async (_data, _variables) => {
      await queryClient.invalidateQueries({ queryKey: ["canvases", workspaceId] });
      toast({ title: "캔버스가 삭제되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "캔버스 삭제에 실패했습니다.", variant: "destructive" });
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{workspace?.name || 'Loading...'}</h1>
                <p className="text-sm text-gray-600">Workspace Canvases</p>
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
          <h2 className="text-2xl font-bold text-gray-900">Canvases</h2>
          <Dialog open={showCanvasDialog} onOpenChange={setShowCanvasDialog}>
            <DialogTrigger asChild>
              <Button>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New Canvas
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Canvas</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Canvas Title</Label>
                  <Input
                    id="title"
                    value={newCanvasTitle}
                    onChange={(e) => setNewCanvasTitle(e.target.value)}
                    placeholder="e.g., Q1 Marketing Funnel"
                  />
                </div>
                <Button 
                  onClick={() => createCanvasMutation.mutate(newCanvasTitle)}
                  disabled={!newCanvasTitle || createCanvasMutation.isPending}
                  className="w-full"
                >
                  {createCanvasMutation.isPending ? "Creating..." : "Create Canvas"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {canvasesLoading || workspaceLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          </div>
        ) : canvases.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <FileText className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No canvases yet
            </h3>
            <p className="text-gray-600 mb-4">
              Create your first canvas to start building funnels
            </p>
            <Button variant="secondary" onClick={() => setShowCanvasDialog(true)}>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create First Canvas
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {canvases.map((canvas) => (
              <CanvasCardItem
                key={canvas.id}
                canvas={canvas}
                onShare={() => setShareCanvas(canvas)}
                onDelete={() => {
                  if (confirm(`"${canvas.title}" 캔버스를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
                    deleteCanvasMutation.mutate(canvas.id as unknown as string);
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {shareCanvas && (
        <CanvasShareModal
          canvasId={shareCanvas.id}
          canvasTitle={shareCanvas.title}
          isOpen={!!shareCanvas}
          onClose={() => setShareCanvas(null)}
        />
      )}
    </div>
  );
}