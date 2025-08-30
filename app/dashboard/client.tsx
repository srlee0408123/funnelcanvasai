"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { CanvasShareModal } from "@/components/Modals/CanvasShareModal";
import { Share } from "lucide-react";
import type { Workspace, Canvas } from "@shared/schema";

export default function DashboardClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newCanvasTitle, setNewCanvasTitle] = useState("");
  const [showWorkspaceDialog, setShowWorkspaceDialog] = useState(false);
  const [showCanvasDialog, setShowCanvasDialog] = useState(false);
  const [shareCanvas, setShareCanvas] = useState<Canvas | null>(null);

  // Fetch workspaces
  const { data: workspaces, isLoading: workspacesLoading } = useQuery<Workspace[]>({
    queryKey: ["/api/workspaces"],
    enabled: !!session,
    retry: false,
  });

  // Fetch user accessible canvases
  const { data: allCanvases = [], isLoading: canvasesLoading } = useQuery<Canvas[]>({
    queryKey: ["/api/user/canvases"],
    enabled: !!session,
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });

  // Show workspace creation dialog for new users
  useEffect(() => {
    if (session && workspaces !== undefined && workspaces.length === 0 && !showWorkspaceDialog) {
      setShowWorkspaceDialog(true);
    }
  }, [session, workspaces, showWorkspaceDialog]);

  // Create workspace mutation
  const createWorkspaceMutation = useMutation({
    mutationFn: async (name: string) => {
      await apiRequest("POST", "/api/workspaces", { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces"] });
      setShowWorkspaceDialog(false);
      setNewWorkspaceName("");
      toast({ title: "워크스페이스가 생성되었습니다." });
    },
    onError: () => {
      toast({ 
        title: "오류", 
        description: "워크스페이스 생성에 실패했습니다.", 
        variant: "destructive" 
      });
    },
  });

  // Create canvas mutation
  const createCanvasMutation = useMutation({
    mutationFn: async (title: string) => {
      if (!workspaces?.[0]?.id) throw new Error("No workspace found");
      await apiRequest("POST", `/api/workspaces/${workspaces[0].id}/canvases`, { title });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/canvases"] });
      setShowCanvasDialog(false);
      setNewCanvasTitle("");
      toast({ title: "캔버스가 생성되었습니다." });
    },
    onError: () => {
      toast({ 
        title: "오류", 
        description: "캔버스 생성에 실패했습니다.", 
        variant: "destructive" 
      });
    },
  });

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
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
              <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
                <i className="fas fa-brain text-white text-sm"></i>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">두더지 AI</h1>
                <p className="text-sm text-gray-600">Funnel Canvas</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {session?.user?.email}
              </span>
              <Link href="/admin">
                <Button variant="outline" size="sm">
                  <i className="fas fa-cog mr-2"></i>
                  관리자
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">내 캔버스</h2>
          <Dialog open={showCanvasDialog} onOpenChange={setShowCanvasDialog}>
            <DialogTrigger asChild>
              <Button>
                <i className="fas fa-plus mr-2"></i>
                새 캔버스
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>새 캔버스 만들기</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">캔버스 제목</Label>
                  <Input
                    id="title"
                    value={newCanvasTitle}
                    onChange={(e) => setNewCanvasTitle(e.target.value)}
                    placeholder="예: Q1 마케팅 퍼널"
                  />
                </div>
                <Button 
                  onClick={() => createCanvasMutation.mutate(newCanvasTitle)}
                  disabled={!newCanvasTitle || createCanvasMutation.isPending}
                  className="w-full"
                >
                  {createCanvasMutation.isPending ? "생성 중..." : "캔버스 만들기"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {canvasesLoading || workspacesLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto"></div>
          </div>
        ) : allCanvases.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-gray-400 mb-4">
              <i className="fas fa-folder-open text-6xl"></i>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              아직 캔버스가 없습니다
            </h3>
            <p className="text-gray-600 mb-4">
              첫 번째 캔버스를 만들어 퍼널 설계를 시작하세요
            </p>
            <Button onClick={() => setShowCanvasDialog(true)}>
              <i className="fas fa-plus mr-2"></i>
              첫 캔버스 만들기
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allCanvases.map((canvas) => (
              <Card key={canvas.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{canvas.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.preventDefault();
                        setShareCanvas(canvas);
                      }}
                    >
                      <Share className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-gray-600 mb-4">
                    <div className="flex items-center mb-1">
                      <i className="fas fa-calendar-alt mr-2"></i>
                      {new Date(canvas.createdAt).toLocaleDateString("ko-KR")}
                    </div>
                    <div className="flex items-center">
                      <i className="fas fa-edit mr-2"></i>
                      {new Date(canvas.updatedAt).toLocaleDateString("ko-KR")}
                    </div>
                  </div>
                  <Link href={`/canvas/${canvas.id}`}>
                    <Button className="w-full">
                      <i className="fas fa-arrow-right mr-2"></i>
                      캔버스 열기
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Workspace Creation Dialog */}
      <Dialog open={showWorkspaceDialog} onOpenChange={setShowWorkspaceDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>워크스페이스 만들기</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="workspace-name">워크스페이스 이름</Label>
              <Input
                id="workspace-name"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="예: 마케팅 팀"
              />
            </div>
            <Button 
              onClick={() => createWorkspaceMutation.mutate(newWorkspaceName)}
              disabled={!newWorkspaceName || createWorkspaceMutation.isPending}
              className="w-full"
            >
              {createWorkspaceMutation.isPending ? "생성 중..." : "워크스페이스 만들기"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Modal */}
      {shareCanvas && (
        <CanvasShareModal
          canvas={shareCanvas}
          onClose={() => setShareCanvas(null)}
        />
      )}
    </div>
  );
}