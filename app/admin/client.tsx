"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/Ui/buttons";
import { Input, Textarea, Label } from "@/components/Ui/form-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/Ui/data-display";
import { Brain } from "lucide-react";
import Link from "next/link";
import UploadButtons from "@/components/Admin/UploadButtons";
import KnowledgeList from "@/components/Admin/KnowledgeList";
import UploadModal from "@/components/Modals/UploadModal";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { DEFAULT_ONBOARDING_SYSTEM_PROMPT } from "@/services/onboardingPrompt";

interface AdminStats {
  totalUsers: number;
  totalCanvases: number;
  totalTemplates: number;
}

interface GlobalKnowledge {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  sourceUrl?: string;
  createdAt: string;
}

export default function AdminClient() {
  const [activeTab, setActiveTab] = useState("overview");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadType, setUploadType] = useState<"pdf" | "youtube" | "url" | "text">("pdf");
  
  const { toast } = useToast();

  // Users tab state
  const [usersPage, setUsersPage] = useState(1);
  const [usersLimit] = useState(10);
  const [appliedQuery, setAppliedQuery] = useState("");
  const [appliedPlan, setAppliedPlan] = useState<"all" | "free" | "pro">("all");
  type UsersApiResponse = { success: boolean; data: any[]; page: number; limit: number; total: number; totalPages: number } | null;
  const { data: usersPayload, refetch: refetchUsers, isLoading: isUsersLoading } = useQuery<UsersApiResponse>({
    queryKey: ["/api/admin/users", usersPage, usersLimit, appliedQuery, appliedPlan],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", String(usersPage));
      params.set("limit", String(usersLimit));
      if (appliedQuery) params.set("q", appliedQuery);
      if (appliedPlan !== "all") params.set("plan", appliedPlan);
      const res = await apiRequest("GET", `/api/admin/users?${params.toString()}`);
      const json = await res.json();
      return json;
    },
    enabled: activeTab === "users",
    // keepPreviousData avoids UI flicker when moving pages
    // and makes pagination smoother
    // @ts-ignore
    keepPreviousData: true,
  });
  const usersMeta = usersPayload as any;
  const usersData = Array.isArray(usersMeta?.data) ? usersMeta.data : [];

  useEffect(() => {
    if (activeTab === "users") {
      refetchUsers();
    }
  }, [activeTab, refetchUsers]);

  // When page or applied filters change and users tab is active, refetch
  useEffect(() => {
    if (activeTab === "users") {
      refetchUsers();
    }
  }, [usersPage, usersLimit, appliedQuery, appliedPlan, activeTab, refetchUsers]);

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}`, updates);
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "사용자 정보가 업데이트되었습니다." });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      refetchUsers();
    },
    onError: () => {
      toast({ title: "업데이트 실패", description: "사용자 업데이트 중 오류가 발생했습니다.", variant: "destructive" });
    }
  });

  // Filters for Users tab
  const [userQuery, setUserQuery] = useState("");
  const [userPlan, setUserPlan] = useState<"all" | "free" | "pro">("all");

  const handleSearchUsers = () => {
    setAppliedQuery(userQuery.trim());
    setAppliedPlan(userPlan);
    setUsersPage(1);
  };

  // RAG 프롬프트 목록 로드
  const { data: ragPrompts = [], refetch: refetchRagPrompts, isLoading: isRagLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/rag-prompts"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/rag-prompts");
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    },
    enabled: false,
  });
  // 온보딩 프롬프트 편집 상태
  const [onboardingContent, setOnboardingContent] = useState("");
  const [onboardingInitial, setOnboardingInitial] = useState("");

  // ragPrompts 로드 시 온보딩 프롬프트 내용 초기화
  useEffect(() => {
    const onboarding = (ragPrompts as any[])?.find((p) => String(p.name) === "ONBOARDING_SYSTEM_PROMPT");
    const content = String(onboarding?.content || DEFAULT_ONBOARDING_SYSTEM_PROMPT || "");
    setOnboardingContent(content);
    setOnboardingInitial(content);
  }, [ragPrompts]);

  // 온보딩 프롬프트 저장 (있으면 PATCH, 없으면 POST) - UI는 "편집만" 노출
  const saveOnboardingPromptMutation = useMutation({
    mutationFn: async () => {
      const onboarding = (ragPrompts as any[])?.find((p) => String(p.name) === "ONBOARDING_SYSTEM_PROMPT");
      if (onboarding && onboarding.id) {
        const res = await apiRequest("PATCH", `/api/admin/rag-prompts/${onboarding.id}`, {
          content: onboardingContent,
        });
        return res.json();
      }
      const res = await apiRequest("POST", "/api/admin/rag-prompts", {
        name: "ONBOARDING_SYSTEM_PROMPT",
        content: onboardingContent,
        is_active: true,
        version: 1,
      });
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "온보딩 프롬프트가 저장되었습니다." });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/rag-prompts"] });
      refetchRagPrompts();
    },
    onError: () => {
      toast({ title: "저장 실패", description: "온보딩 프롬프트 저장 중 오류가 발생했습니다.", variant: "destructive" });
    }
  });

  // 선택된 프롬프트 로그 (최신 10개)
  const [selectedPromptIdForLogs, setSelectedPromptIdForLogs] = useState<string | null>(null);
  const { data: promptLogs = [], refetch: refetchPromptLogs, isLoading: isLogsLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/rag-prompts", selectedPromptIdForLogs, "logs"],
    queryFn: async () => {
      if (!selectedPromptIdForLogs) return [];
      const res = await apiRequest("GET", `/api/admin/rag-prompts/${selectedPromptIdForLogs}?limit=10`);
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    },
    enabled: false,
  });

  useEffect(() => {
    if (activeTab === "ai-chat-prompt") {
      refetchRagPrompts();
    }
  }, [activeTab, refetchRagPrompts]);

  useEffect(() => {
    if (selectedPromptIdForLogs) {
      refetchPromptLogs();
    }
  }, [selectedPromptIdForLogs, refetchPromptLogs]);

  const updatePromptMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/rag-prompts/${id}`, updates);
      return res.json();
    },
    onSuccess: async () => {
      toast({ title: "프롬프트가 업데이트되었습니다." });
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/rag-prompts"] });
      refetchRagPrompts();
    },
    onError: () => {
      toast({ title: "업데이트 실패", description: "프롬프트 업데이트 중 오류가 발생했습니다.", variant: "destructive" });
    }
  });
  // 편집 상태 및 핸들러 (생성 제거)
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingContent, setEditingContent] = useState("");
  const [editingDescription, setEditingDescription] = useState("");

  const handleStartEdit = (p: any) => {
    setEditingPromptId(p.id);
    setEditingName(String(p.name || ""));
    setEditingContent(String(p.content || ""));
    setEditingDescription(String(p.description || ""));
  };

  const handleCancelEdit = () => {
    setEditingPromptId(null);
    setEditingName("");
    setEditingContent("");
    setEditingDescription("");
  };

  const handleSaveEdit = async () => {
    if (!editingPromptId) return;
    await (updatePromptMutation as any).mutateAsync({
      id: editingPromptId,
      // 이름 변경 금지: content만 업데이트
      updates: { content: editingContent.trim(), description: editingDescription.trim() }
    });
    setEditingPromptId(null);
    setEditingName("");
    setEditingContent("");
    setEditingDescription("");
  };

  // Fetch admin stats
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/stats");
      return response as unknown as AdminStats;
    },
  });

  // Fetch global knowledge list
  const { data: globalKnowledgeList = [], isLoading: isKnowledgeLoading } = useQuery<GlobalKnowledge[]>({
    queryKey: ["/api/admin/global-knowledge"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/global-knowledge");
      const json = await res.json().catch(() => null);
      return Array.isArray(json) ? (json as GlobalKnowledge[]) : [];
    },
  });

  // Delete knowledge mutation
  const deleteKnowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/global-knowledge/${id}`);
      return id;
    },
    onSuccess: (deletedId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/global-knowledge"] });
      toast({ title: "지식이 삭제되었습니다." });
    },
    onError: (error) => {
      console.error("Delete knowledge error:", error);
      toast({
        title: "삭제 실패",
        description: "지식 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  /**
   * 업로드 모달 열기 핸들러
   * 선택된 타입에 따라 업로드 모달 표시
   */
  const handleOpenUploadModal = (type: "pdf" | "youtube" | "url" | "text") => {
    setUploadType(type);
    setShowUploadModal(true);
  };

  /**
   * 업로드 완료 핸들러
   * 글로벌 지식으로 저장 후 목록 새로고침
   */
  const handleUploadComplete = async (_uploadData: any) => {
    // 모달에서 이미 생성 API를 호출하므로, 여기서는 목록 갱신과 모달 닫기만 수행
    await queryClient.invalidateQueries({ queryKey: ["/api/admin/global-knowledge"] });
    setShowUploadModal(false);
    toast({ title: "글로벌 지식이 추가되었습니다." });
  };

  /**
   * 지식 삭제 핸들러
   * 뮤테이션을 통해 삭제 처리
   */
  const handleDeleteKnowledge = (id: string) => {
    deleteKnowledgeMutation.mutate(id);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <i className="fas fa-arrow-left mr-2"></i>
                  대시보드로
                </Button>
              </Link>
              <h1 className="text-xl font-bold text-gray-900">관리자 페이지</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="overview">개요</TabsTrigger>
            <TabsTrigger value="users">사용자</TabsTrigger>
            <TabsTrigger value="canvases">캔버스</TabsTrigger>
            <TabsTrigger value="templates">템플릿</TabsTrigger>
            <TabsTrigger value="knowledge">AI 지식</TabsTrigger>
            <TabsTrigger value="ai-chat-prompt">AIChat 프롬프트</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>총 사용자</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats?.totalUsers || 0}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>총 캔버스</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats?.totalCanvases || 0}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle>총 템플릿</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">{stats?.totalTemplates || 0}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>사용자 관리</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="col-span-1 md:col-span-2 flex items-center space-x-2">
                    <Input
                      placeholder="이메일 검색"
                      value={userQuery}
                      onChange={(e) => {
                        setUserQuery(e.target.value);
                        setAppliedQuery(e.target.value.trim());
                        setUsersPage(1);
                      }}
                    />
                  </div>
                  <div>
                    <Select value={userPlan} onValueChange={(v: any) => { setUserPlan(v); setAppliedPlan(v); setUsersPage(1); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="플랜" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">모든 플랜</SelectItem>
                        <SelectItem value="free">free</SelectItem>
                        <SelectItem value="pro">pro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-end">
                    <Button variant="outline" size="sm" onClick={() => refetchUsers()}>새로고침</Button>
                  </div>
                </div>
                {
                  isUsersLoading ? (
                    <div className="text-sm text-gray-500">불러오는 중...</div>
                  ) : usersData.length === 0 ? (
                    <div className="text-sm text-gray-500">사용자가 없습니다.</div>
                  ) : (
                    <div className="overflow-x-auto text-xs">
                      <Table className="text-xs">
                        <TableHeader>
                          <TableRow>
                            <TableHead>이메일</TableHead>
                            <TableHead>전화번호(마스킹)</TableHead>
                            <TableHead>플랜</TableHead>
                            <TableHead>가입일</TableHead>
                            <TableHead>멤버십 상태</TableHead>
                            <TableHead>현재 기간 시작</TableHead>
                            <TableHead>현재 기간 종료</TableHead>
                            <TableHead>다음 갱신 예정</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usersData.map((u: any) => (
                            <TableRow key={u.email}>
                              <TableCell className="font-mono text-[11px]">{u.email}</TableCell>
                              <TableCell className="text-[11px] whitespace-nowrap">{u.phoneMasked || '-'}</TableCell>
                              <TableCell className="w-32">
                                <Select
                                  defaultValue={u.plan || 'free'}
                                  onValueChange={(value) => updateUserMutation.mutate({ userId: u.id, updates: { plan: value } })}
                                  disabled={updateUserMutation.isPending}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="플랜 선택" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="free">free</SelectItem>
                                    <SelectItem value="pro">pro</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell className="text-[11px] whitespace-nowrap">{u.createdAt ? new Date(u.createdAt).toLocaleDateString('ko-KR') : '-'}</TableCell>
                              <TableCell className="text-[11px] whitespace-nowrap">{u.membership?.status || '-'}</TableCell>
                              <TableCell className="text-[11px] whitespace-nowrap">{u.membership?.current_period_start ? new Date(u.membership.current_period_start).toLocaleString('ko-KR') : '-'}</TableCell>
                              <TableCell className="text-[11px] whitespace-nowrap">{u.membership?.current_period_end ? new Date(u.membership.current_period_end).toLocaleString('ko-KR') : '-'}</TableCell>
                              <TableCell className="text-[11px] whitespace-nowrap">{u.membership?.next_renewal_at ? new Date(u.membership.next_renewal_at).toLocaleString('ko-KR') : '-'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                      <div className="flex items-center justify-between mt-3">
                        <div className="text-[11px] text-gray-500">
                          페이지 {(usersMeta && usersMeta.page) || 1} / {(usersMeta && usersMeta.totalPages) || 1} · 총 {(usersMeta && usersMeta.total) || 0}명
                        </div>
                        <div className="space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={((usersMeta && usersMeta.page) || 1) <= 1 || isUsersLoading}
                            onClick={() => { setUsersPage((p) => Math.max(1, p - 1)); }}
                          >이전</Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={((usersMeta && usersMeta.page) || 1) >= ((usersMeta && usersMeta.totalPages) || 1) || isUsersLoading}
                            onClick={() => { setUsersPage((p) => p + 1); }}
                          >다음</Button>
                        </div>
                      </div>
                    </div>
                  )
                }
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="canvases">
            <Card>
              <CardHeader>
                <CardTitle>캔버스 관리</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">모든 캔버스 목록 및 관리 기능이 여기에 표시됩니다.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates">
            <Card>
              <CardHeader>
                <CardTitle>템플릿 관리</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">퍼널 템플릿 관리 기능이 여기에 표시됩니다.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="knowledge">
            <div className="space-y-6">
              {/* 헤더 섹션 */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">글로벌 AI 지식</h2>
                  <p className="text-gray-600">모든 사용자가 공유하는 범용 지식 베이스</p>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-gray-500">
                    총 {globalKnowledgeList.length}개 지식
                  </span>
                </div>
              </div>

              {/* 4열 업로드 버튼 섹션 */}
              <UploadButtons onOpenUploadModal={handleOpenUploadModal} />

              {/* 지식 목록 - 리스트 형태 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Brain className="h-5 w-5 mr-2 text-purple-600" />
                    지식 목록
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <KnowledgeList 
                    knowledgeList={globalKnowledgeList}
                    isLoading={isKnowledgeLoading}
                    onDelete={handleDeleteKnowledge}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ai-chat-prompt">
            <div className="space-y-6">
              {/* 헤더 섹션 */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">AI Chat 프롬프트 관리</h2>
                  <p className="text-gray-600">AI 채팅 시스템의 프롬프트 템플릿을 관리합니다</p>
                </div>
                {/* 생성 버튼 제거 */}
              </div>

              {/* 온보딩 프롬프트 빠른 액세스/생성 섹션 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Brain className="h-5 w-5 mr-2 text-emerald-600" />
                    온보딩 프롬프트
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* 현재 사용 중인 프롬프트를 그대로 편집만 가능 */}
                  <div className="space-y-3">
                    <Textarea
                      value={onboardingContent}
                      onChange={(e) => setOnboardingContent(e.target.value)}
                      rows={12}
                      className="w-full resize-none"
                    />
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOnboardingContent(onboardingInitial)}
                        disabled={saveOnboardingPromptMutation.isPending}
                      >
                        되돌리기
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => (saveOnboardingPromptMutation as any).mutate()}
                        disabled={saveOnboardingPromptMutation.isPending || !onboardingContent.trim()}
                      >
                        저장
                      </Button>
                    </div>
                    <div className="text-xs text-gray-500">현재 탭에서 편집한 내용이 온보딩 시스템에 즉시 반영됩니다.</div>
                  </div>
                </CardContent>
              </Card>

              {/* 시스템 프롬프트만 표시 (설정 섹션 제거) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Brain className="h-5 w-5 mr-2 text-blue-600" />
                    시스템 프롬프트
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* 목록 */}
                  <div className="space-y-4">
                    {isRagLoading ? (
                      <div className="text-sm text-gray-500">불러오는 중...</div>
                    ) : ragPrompts.length === 0 ? (
                      <div className="text-sm text-gray-500">등록된 프롬프트가 없습니다.</div>
                    ) : (
                      ragPrompts.map((p: any) => (
                        <div key={p.id} className="p-4 border rounded-lg">
                          {editingPromptId === p.id ? (
                            // 편집 모드: 전체 너비 사용
                            <div className="space-y-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium text-gray-900">{p.name}</h4>
                                  {p.is_active ? (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">활성</span>
                                  ) : (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">비활성</span>
                                  )}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Button variant="outline" size="sm" onClick={handleCancelEdit} disabled={updatePromptMutation.isPending}>취소</Button>
                                  <Button variant="outline" size="sm" onClick={handleSaveEdit} disabled={updatePromptMutation.isPending || !editingName.trim() || !editingContent.trim()}>저장</Button>
                                  <Button variant="outline" size="sm" onClick={() => setSelectedPromptIdForLogs(p.id)} disabled={isLogsLoading && selectedPromptIdForLogs === p.id}>로그 보기</Button>
                                </div>
                              </div>
                              <div className="space-y-3">
                                <div>
                                  <Label htmlFor={`editName-${p.id}`}>프롬프트 이름</Label>
                                  <Input
                                    id={`editName-${p.id}`}
                                    value={editingName}
                                    disabled
                                    className="w-full bg-gray-100 cursor-not-allowed"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`editContent-${p.id}`}>프롬프트 내용</Label>
                                  <Textarea
                                    id={`editContent-${p.id}`}
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    rows={10}
                                    className="w-full resize-none"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor={`editDescription-${p.id}`}>설명 (관리자용)</Label>
                                  <Textarea
                                    id={`editDescription-${p.id}`}
                                    value={editingDescription}
                                    onChange={(e) => setEditingDescription(e.target.value)}
                                    rows={4}
                                    className="w-full resize-none"
                                    placeholder="이 프롬프트의 의도/사용 상황/주의사항 등을 정리하세요."
                                  />
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">버전 {p.version} · 업데이트 {new Date(p.updated_at).toLocaleString('ko-KR')}</div>
                            </div>
                          ) : (
                            // 일반 모드: 좌우 배치
                            <div className="flex items-start justify-between">
                              <div className="flex-1 pr-4">
                                <div className="flex items-center space-x-2">
                                  <h4 className="font-medium text-gray-900">{p.name}</h4>
                                  {p.is_active ? (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">활성</span>
                                  ) : (
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">비활성</span>
                                  )}
                                </div>
                                {p.description && (
                                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{String(p.description)}</p>
                                )}
                                <pre className="text-sm text-gray-700 whitespace-pre-wrap mt-2">{String(p.content || '').substring(0, 400)}</pre>
                                <div className="text-xs text-gray-500 mt-1">버전 {p.version} · 업데이트 {new Date(p.updated_at).toLocaleString('ko-KR')}</div>
                              </div>
                              <div className="flex flex-col space-y-2">
                                <Button variant="outline" size="sm" onClick={() => handleStartEdit(p)} disabled={editingPromptId !== null && editingPromptId !== p.id}>편집</Button>
                                <Button variant="outline" size="sm" onClick={() => setSelectedPromptIdForLogs(p.id)} disabled={isLogsLoading && selectedPromptIdForLogs === p.id}>로그 보기</Button>
                              </div>
                            </div>
                          )}
                          {selectedPromptIdForLogs === p.id && (
                            <div className="mt-4 bg-gray-50 p-3 rounded-md">
                              <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-gray-700">최근 변경 로그 (최대 10개)</span>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedPromptIdForLogs(null)}>닫기</Button>
                              </div>
                              {isLogsLoading ? (
                                <div className="text-sm text-gray-500 mt-2">로딩 중...</div>
                              ) : promptLogs.length === 0 ? (
                                <div className="text-sm text-gray-500 mt-2">로그가 없습니다.</div>
                              ) : (
                                <div className="mt-2 space-y-3">
                                  {promptLogs.map((log: any) => (
                                    <div key={log.id} className="text-xs text-gray-700 border rounded p-2 bg-white">
                                      <div className="flex justify-between mb-2">
                                        <span>{new Date(log.changed_at).toLocaleString('ko-KR')}</span>
                                        <span className="text-gray-500">by {log.changed_by || 'system'}</span>
                                      </div>
                                      <div className="space-y-2">
                                        <div><span className="font-medium">이름:</span> {String(log.name_after)}</div>
                                        <div className="max-h-32 overflow-y-auto">
                                          <div><span className="font-medium">내용:</span></div>
                                          <pre className="whitespace-pre-wrap text-xs mt-1 bg-gray-50 p-2 rounded">{String(log.content_after)}</pre>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* 업로드 모달 - 기존 모달 재사용 */}
      {showUploadModal && (
        <UploadModal
          uploadType={null}
          type={uploadType}
          onClose={() => setShowUploadModal(false)}
          onComplete={handleUploadComplete}
          isGlobalKnowledge={true}
        />
      )}
    </div>
  );
}

/**
 * InlinePhoneEdit - 전화번호 인라인 편집 컴포넌트(관리자 전용)
 * 
 * 주요 역할:
 * 1. 마스킹된 전화번호를 표시하고, 편집 버튼 클릭 시 입력 필드로 전환
 * 2. 한국 표준형(010XXXXXXXX) 유효성 검사 후 저장 트리거
 * 3. 저장 시 원본 번호는 네트워크 응답에 포함하지 않고(서버에서 마스킹) UI만 갱신
 */
function InlinePhoneEdit({
  userId,
  phoneMasked,
  onSave,
  saving,
}: {
  userId: string;
  phoneMasked: string | null;
  onSave: (phoneNumber: string) => void;
  saving?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const validate = (raw: string): boolean => {
    const digits = (raw || '').replace(/\D/g, '');
    const normalized = digits.length === 8 ? `010${digits}` : digits.startsWith('010') ? digits.slice(0, 11) : digits;
    const ok = /^010\d{8}$/.test(normalized);
    setError(ok ? null : '형식: 010XXXXXXXX');
    return ok;
  };

  const handleSave = () => {
    if (!validate(value)) return;
    onSave(value);
    setIsEditing(false);
  };

  if (!isEditing) {
    return (
      <div className="flex items-center space-x-2">
        <span className="text-sm text-gray-700">{phoneMasked || '-'}</span>
        <Button variant="outline" size="sm" onClick={() => { setIsEditing(true); setValue(''); }} disabled={saving}>수정</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Input
        placeholder="010XXXXXXXX"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-40"
      />
      <Button variant="outline" size="sm" onClick={() => setIsEditing(false)} disabled={saving}>취소</Button>
      <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>저장</Button>
      {error && <span className="text-xs text-red-600 ml-1">{error}</span>}
    </div>
  );
}