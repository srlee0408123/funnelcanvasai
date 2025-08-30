import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trash2, UserPlus, Crown, Shield, Eye, Edit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface WorkspaceMember {
  userId: string;
  role: string;
  invitedAt: string;
  firstName?: string;
  lastName?: string;
  email: string;
  profileImageUrl?: string;
}

interface WorkspaceMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceName: string;
}

const roleConfig = {
  owner: { label: "소유자", icon: Crown, color: "destructive" },
  admin: { label: "관리자", icon: Shield, color: "default" },
  editor: { label: "편집자", icon: Edit, color: "secondary" },
  viewer: { label: "뷰어", icon: Eye, color: "outline" }
};

export function WorkspaceMembersModal({ isOpen, onClose, workspaceId, workspaceName }: WorkspaceMembersModalProps) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch workspace members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => fetch(`/api/workspaces/${workspaceId}/members`, { credentials: 'include' }).then(r => r.json()),
    enabled: isOpen
  });

  // Invite member mutation
  const inviteMutation = useMutation({
    mutationFn: (data: { email: string; role: string }) =>
      apiRequest('POST', `/api/workspaces/${workspaceId}/members/invite`, data),
    onSuccess: () => {
      toast({ title: "멤버 초대 성공", description: "새 멤버가 워크스페이스에 추가되었습니다." });
      setInviteEmail("");
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
    onError: (error: any) => {
      const errorMessage = error.message || "멤버 초대에 실패했습니다.";
      const isUserNotFound = errorMessage.includes("사용자를 찾을 수 없습니다");
      
      toast({ 
        title: "초대 실패", 
        description: isUserNotFound 
          ? errorMessage + " 먼저 해당 사용자가 시스템에 가입하도록 안내해주세요."
          : errorMessage,
        variant: "destructive"
      });
    }
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: (data: { memberId: string; role: string }) =>
      apiRequest('PATCH', `/api/workspaces/${workspaceId}/members/${data.memberId}/role`, { role: data.role }),
    onSuccess: () => {
      toast({ title: "역할 변경 완료", description: "멤버의 역할이 성공적으로 변경되었습니다." });
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
    onError: (error: any) => {
      toast({ 
        title: "역할 변경 실패", 
        description: error.message || "역할 변경에 실패했습니다.",
        variant: "destructive"
      });
    }
  });

  // Remove member mutation
  const removeMutation = useMutation({
    mutationFn: (memberId: string) =>
      apiRequest('DELETE', `/api/workspaces/${workspaceId}/members/${memberId}`),
    onSuccess: () => {
      toast({ title: "멤버 제거 완료", description: "멤버가 워크스페이스에서 제거되었습니다." });
      queryClient.invalidateQueries({ queryKey: ['workspace-members', workspaceId] });
    },
    onError: (error: any) => {
      toast({ 
        title: "멤버 제거 실패", 
        description: error.message || "멤버 제거에 실패했습니다.",
        variant: "destructive"
      });
    }
  });

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      toast({ title: "이메일을 입력하세요", variant: "destructive" });
      return;
    }
    inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole });
  };

  const handleRoleChange = (memberId: string, newRole: string) => {
    updateRoleMutation.mutate({ memberId, role: newRole });
  };

  const handleRemoveMember = (memberId: string) => {
    if (confirm("정말로 이 멤버를 제거하시겠습니까?")) {
      removeMutation.mutate(memberId);
    }
  };

  const getRoleIcon = (role: string) => {
    const config = roleConfig[role as keyof typeof roleConfig];
    if (!config) return null;
    const Icon = config.icon;
    return <Icon className="h-4 w-4" />;
  };

  const getRoleBadge = (role: string) => {
    const config = roleConfig[role as keyof typeof roleConfig];
    if (!config) return <Badge variant="outline">{role}</Badge>;
    
    return (
      <Badge variant={config.color as any} className="flex items-center gap-1">
        {getRoleIcon(role)}
        {config.label}
      </Badge>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            워크스페이스 멤버 관리
          </DialogTitle>
          <p className="text-sm text-muted-foreground">{workspaceName}</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* 멤버 초대 섹션 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">새 멤버 초대</h3>
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
              <strong>참고:</strong> 초대하려는 사용자가 먼저 시스템에 가입되어 있어야 합니다.
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="이메일 주소 (예: user@example.com)"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
                type="email"
              />
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="editor">편집자</SelectItem>
                  <SelectItem value="viewer">뷰어</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                onClick={handleInvite} 
                disabled={inviteMutation.isPending}
                className="whitespace-nowrap"
              >
                {inviteMutation.isPending ? "초대 중..." : "초대하기"}
              </Button>
            </div>
          </div>

          {/* 현재 멤버 목록 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">현재 멤버 ({members.length}명)</h3>
            
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">멤버 목록을 불러오는 중...</div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>멤버</TableHead>
                      <TableHead>역할</TableHead>
                      <TableHead>초대일</TableHead>
                      <TableHead className="w-24">작업</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member: WorkspaceMember) => (
                      <TableRow key={member.userId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={member.profileImageUrl} />
                              <AvatarFallback>
                                {member.firstName?.[0] || member.email[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">
                                {member.firstName && member.lastName 
                                  ? `${member.firstName} ${member.lastName}` 
                                  : member.email
                                }
                              </div>
                              <div className="text-sm text-muted-foreground">{member.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.role === 'owner' ? (
                            getRoleBadge(member.role)
                          ) : (
                            <Select
                              value={member.role}
                              onValueChange={(newRole) => handleRoleChange(member.userId, newRole)}
                              disabled={updateRoleMutation.isPending}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue>
                                  <div className="flex items-center gap-1">
                                    {getRoleIcon(member.role)}
                                    {roleConfig[member.role as keyof typeof roleConfig]?.label || member.role}
                                  </div>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="editor">편집자</SelectItem>
                                <SelectItem value="viewer">뷰어</SelectItem>
                                <SelectItem value="admin">관리자</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(member.invitedAt).toLocaleDateString('ko-KR')}
                        </TableCell>
                        <TableCell>
                          {member.role !== 'owner' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveMember(member.userId)}
                              disabled={removeMutation.isPending}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}