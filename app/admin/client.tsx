"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/Ui/buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/Ui/data-display";
import { Brain } from "lucide-react";
import Link from "next/link";
import UploadButtons from "@/components/Admin/UploadButtons";
import KnowledgeList from "@/components/Admin/KnowledgeList";
import UploadModal from "@/components/Modals/UploadModal";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

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
                <p className="text-gray-600">사용자 목록 및 관리 기능이 여기에 표시됩니다.</p>
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