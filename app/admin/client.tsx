"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/Ui/buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Ui/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/Ui/data-display";
import Link from "next/link";

interface AdminStats {
  totalUsers: number;
  totalCanvases: number;
  totalTemplates: number;
}

export default function AdminClient() {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch admin stats
  const { data: stats } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/admin/stats");
      return response as AdminStats;
    },
  });

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
            <Card>
              <CardHeader>
                <CardTitle>AI 지식 관리</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">글로벌 AI 지식베이스 관리 기능이 여기에 표시됩니다.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}