import { useState } from "react";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Ui/data-display";
import { Button, Badge } from "@/components/Ui/buttons";
import { Input } from "@/components/Ui/form-controls";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, invalidateCanvasQueries } from "@/lib/queryClient";
import { Users, Share, Trash2, Eye, Edit } from "lucide-react";

interface CanvasShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  canvasId: string;
  canvasTitle: string;
}

interface CanvasShare {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    profileImageUrl?: string;
  };
}

const roleConfig = {
  editor: { label: "편집자", icon: Edit, color: "secondary" },
  viewer: { label: "뷰어", icon: Eye, color: "outline" }
};

export function CanvasShareModal({ isOpen, onClose, canvasId, canvasTitle }: CanvasShareModalProps) {
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState("editor");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch canvas shares (standardized query key to work with invalidateCanvasQueries)
  const { data: shares = [], isLoading } = useQuery<CanvasShare[]>({
    queryKey: ["/api/canvases", canvasId, "shares"],
    enabled: isOpen,
  });

  // Share canvas mutation
  const shareMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiRequest('POST', `/api/canvases/${canvasId}/shares`, data),
    onSuccess: async () => {
      toast({ title: "캔버스 공유 성공", description: "캔버스가 성공적으로 공유되었습니다." });
      setShareEmail("");
      await invalidateCanvasQueries({ canvasId, client: queryClient, targets: ["shares"] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "캔버스 공유에 실패했습니다.";
      const isUserNotFound = errorMessage.includes("사용자를 찾을 수 없습니다");
      
      toast({ 
        title: "공유 실패", 
        description: isUserNotFound 
          ? errorMessage + " 먼저 해당 사용자가 시스템에 가입하도록 안내해주세요."
          : errorMessage,
        variant: "destructive"
      });
    }
  });

  // Remove share mutation
  const removeMutation = useMutation({
    mutationFn: (userId: string) =>
      apiRequest('DELETE', `/api/canvases/${canvasId}/shares/${userId}`),
    onSuccess: async () => {
      toast({ title: "공유 해제 성공", description: "캔버스 공유가 해제되었습니다." });
      await invalidateCanvasQueries({ canvasId, client: queryClient, targets: ["shares"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "공유 해제 실패", 
        description: error.message || "공유 해제에 실패했습니다.",
        variant: "destructive"
      });
    }
  });

  const handleShare = () => {
    if (!shareEmail.trim()) return;
    shareMutation.mutate({ email: shareEmail, role: shareRole });
  };

  // Role change mutation
  const changeRoleMutation = useMutation({
    mutationFn: (payload: { userId: string; role: 'editor' | 'viewer' }) =>
      apiRequest('PATCH', `/api/canvases/${canvasId}/shares/${payload.userId}`, { role: payload.role }),
    onSuccess: async () => {
      toast({ title: '역할 변경 완료', description: '공유된 사용자의 역할이 변경되었습니다.' });
      await invalidateCanvasQueries({ canvasId, client: queryClient, targets: ["shares"] });
    },
    onError: (error: any) => {
      toast({ title: '역할 변경 실패', description: error.message || '역할 변경에 실패했습니다.', variant: 'destructive' });
    }
  });

  const handleChangeRole = (userId: string, role: 'editor' | 'viewer') => {
    changeRoleMutation.mutate({ userId, role });
  };

  const handleRemoveShare = (userId: string) => {
    removeMutation.mutate(userId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share className="h-5 w-5" />
            &ldquo;{canvasTitle}&rdquo; 캔버스 공유
          </DialogTitle>
          <DialogDescription>
            특정 사용자와 개별 캔버스를 공유할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 새 사용자 공유 섹션 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">새 사용자와 공유</h3>
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
              <strong>참고:</strong> 공유하려는 사용자가 먼저 시스템에 가입되어 있어야 합니다.
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="이메일 주소 (예: user@example.com)"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                className="flex-1"
                type="email"
              />
              <Select value={shareRole} onValueChange={setShareRole}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">편집자</SelectItem>
                  <SelectItem value="viewer">뷰어</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleShare}
                disabled={!shareEmail.trim() || shareMutation.isPending}
              >
                {shareMutation.isPending ? "공유 중..." : "공유하기"}
              </Button>
            </div>
          </div>

          {/* 현재 공유된 사용자 목록 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              공유된 사용자 ({shares.length}명)
            </h3>
            
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="h-10 w-10 bg-gray-200 rounded-full"></div>
                      <div className="space-y-1">
                        <div className="h-4 bg-gray-200 rounded w-32"></div>
                        <div className="h-3 bg-gray-200 rounded w-24"></div>
                      </div>
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-16"></div>
                  </div>
                ))}
              </div>
            ) : shares.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Share className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>아직 공유된 사용자가 없습니다</p>
                <p className="text-sm">위에서 이메일을 입력하여 캔버스를 공유해보세요</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {shares.map((share: CanvasShare) => {
                  const roleInfo = roleConfig[share.role as keyof typeof roleConfig];
                  const RoleIcon = roleInfo?.icon || Edit;
                  
                  return (
                    <div key={share.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50">
                      <div className="flex items-center space-x-3">
                        <div className="h-10 w-10 bg-gray-200 rounded-full flex items-center justify-center">
                          {share.user.profileImageUrl ? (
                            <Image 
                              src={share.user.profileImageUrl}
                              alt="Profile"
                              width={40}
                              height={40}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-medium text-gray-600">
                              {(share.user.firstName?.[0] || share.user.email[0]).toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {share.user.firstName && share.user.lastName 
                              ? `${share.user.firstName} ${share.user.lastName}`
                              : share.user.email
                            }
                          </p>
                          <p className="text-sm text-gray-500">{share.user.email}</p>
                          <p className="text-xs text-gray-400">
                            공유일: {new Date(share.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={share.role} onValueChange={(v) => handleChangeRole(share.userId, v as 'editor' | 'viewer')}>
                          <SelectTrigger className="w-28">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="editor">편집자</SelectItem>
                            <SelectItem value="viewer">뷰어</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveShare(share.userId)}
                          disabled={removeMutation.isPending}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}