import { Button } from "@/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

import type { Asset } from "@shared/schema";

interface Node {
  id: string;
  type: string;
  data: {
    title: string;
    subtitle?: string;
    icon: string;
    color: string;
  };
  position: {
    x: number;
    y: number;
  };
}

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenUploadModal: (type: "pdf" | "youtube" | "url") => void;
  onOpenTemplateModal: () => void;
  onOpenMembersModal?: () => void;
  assets: Asset[];
  workspaceId: string;
  workspaceName?: string;
  selectedNode?: Node | null;
  showNodeDetails?: boolean;
  onCloseNodeDetails?: () => void;
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  onOpenUploadModal,
  onOpenTemplateModal,
  onOpenMembersModal,
  assets,
  workspaceId,
  workspaceName,
  selectedNode,
  showNodeDetails = false,
  onCloseNodeDetails,
}: SidebarProps) {
  const { toast } = useToast();

  // Delete asset mutation
  const deleteAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      await apiRequest("DELETE", `/api/assets/${assetId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "assets"] });
      toast({ title: "자료가 삭제되었습니다." });
    },
    onError: (error) => {
      if (isUnauthorizedError(error as Error)) {
        toast({
          title: "권한 없음",
          description: "로그아웃되었습니다. 다시 로그인해 주세요.",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      console.error("Delete asset error:", error);
      toast({
        title: "삭제 실패",
        description: "자료 삭제 중 오류가 발생했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAsset = (assetId: string, assetTitle: string) => {
    if (confirm(`"${assetTitle}" 자료를 정말 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) {
      deleteAssetMutation.mutate(assetId);
    }
  };
  const getAssetIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return "fas fa-file-pdf text-red-500";
      case "youtube":
        return "fab fa-youtube text-red-600";
      case "url":
        return "fas fa-link text-blue-500";
      case "text":
        return "fas fa-file-alt text-green-500";
      default:
        return "fas fa-file text-gray-500";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-500";
      case "processing":
        return "bg-yellow-500 animate-pulse";
      case "failed":
        return "bg-red-500";
      default:
        return "bg-gray-400";
    }
  };

  const getNodeColorClasses = (color: string) => {
    switch (color) {
      case "blue":
        return "bg-blue-100 text-blue-600";
      case "green":
        return "bg-green-100 text-green-600";
      case "purple":
        return "bg-purple-100 text-purple-600";
      case "orange":
        return "bg-orange-100 text-orange-600";
      case "red":
        return "bg-red-100 text-red-600";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  if (collapsed) {
    return (
      <div className="w-16 min-w-[4rem] bg-white border-r border-gray-200 flex flex-col transition-all duration-300">
        <div className="p-4">
          <button
            onClick={onToggleCollapse}
            className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center"
          >
            <i className="fas fa-brain text-white text-sm"></i>
          </button>
        </div>
      </div>
    );
  }

  // Render node details if showing
  if (showNodeDetails && selectedNode) {
    return (
      <div className="w-80 min-w-[20rem] max-w-[25rem] bg-white border-r border-gray-200 flex flex-col transition-all duration-300">
        {/* Node Details Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${getNodeColorClasses(selectedNode.data.color)}`}>
                <i className={selectedNode.data.icon + " text-sm"}></i>
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">{selectedNode.data.title}</h1>
                <p className="text-xs text-gray-500">노드 세부 설정</p>
              </div>
            </div>
            <button 
              onClick={onCloseNodeDetails}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <i className="fas fa-times text-gray-400 text-sm"></i>
            </button>
          </div>
        </div>

        {/* Node Details Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">노드 제목</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue={selectedNode.data.title}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">설명</label>
              <textarea 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20"
                defaultValue={selectedNode.data.subtitle || ""}
                placeholder="노드에 대한 설명을 입력하세요"
              />
            </div>

            {/* Position Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">위치 정보</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
                <div>X: {Math.round(selectedNode.position.x)}</div>
                <div>Y: {Math.round(selectedNode.position.y)}</div>
              </div>
            </div>

            {/* Node Type Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-gray-700 mb-2">노드 타입</h4>
              <div className="text-sm text-gray-600">{selectedNode.type}</div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 space-y-2">
              <Button className="w-full" variant="outline">
                <i className="fas fa-save mr-2"></i>
                변경사항 저장
              </Button>
              <Button className="w-full" variant="outline">
                <i className="fas fa-copy mr-2"></i>
                노드 복사
              </Button>
              <Button className="w-full" variant="destructive">
                <i className="fas fa-trash mr-2"></i>
                노드 삭제
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 min-w-[20rem] max-w-[25rem] bg-white border-r border-gray-200 flex flex-col transition-all duration-300">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <i className="fas fa-brain text-white text-sm"></i>
            </div>
            <div>
              <h1 className="font-semibold text-gray-900">두더지 AI</h1>
              <p className="text-xs text-gray-500">Creator Canvas</p>
            </div>
          </div>
          <button
            onClick={onToggleCollapse}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <i className="fas fa-chevron-left text-sm"></i>
          </button>
        </div>
      </div>
      {/* Upload Section */}
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-medium text-gray-900 mb-3">지식 업로드</h3>
        <div className="space-y-2">
          <button
            onClick={() => onOpenUploadModal("pdf")}
            className="w-full p-3 border-2 border-dashed border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <i className="fas fa-file-pdf text-red-500"></i>
              <span className="text-sm text-gray-600">PDF 문서 업로드</span>
            </div>
          </button>
          
          <button
            onClick={() => onOpenUploadModal("youtube")}
            className="w-full p-3 border-2 border-dashed border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <i className="fab fa-youtube text-red-600"></i>
              <span className="text-sm text-gray-600">유튜브 영상 링크</span>
            </div>
          </button>
          
          <button
            onClick={() => onOpenUploadModal("url")}
            className="w-full p-3 border-2 border-dashed border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <i className="fas fa-link text-blue-500"></i>
              <span className="text-sm text-gray-600">웹사이트 URL</span>
            </div>
          </button>
        </div>
      </div>
      {/* Workspace Management */}
      {onOpenMembersModal && (
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-medium text-gray-900 mb-3">워크스페이스 관리</h3>
          <button
            onClick={onOpenMembersModal}
            className="w-full p-3 border-2 border-dashed border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <i className="fas fa-users text-orange-500"></i>
              <span className="text-sm text-gray-600">멤버 관리</span>
            </div>
          </button>
        </div>
      )}
      {/* Assets List */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-gray-900">업로드된 자료</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
            {assets.length}개
          </span>
        </div>
        
        {assets.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <i className="fas fa-upload text-gray-400"></i>
            </div>
            <p className="text-sm text-gray-500">업로드된 자료가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="group p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <i className={`${getAssetIcon(asset.type)} mt-1`}></i>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {asset.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {asset.status === "completed" && "처리 완료"}
                      {asset.status === "processing" && "처리 중"}
                      {asset.status === "failed" && "처리 실패"}
                      {asset.status === "pending" && "대기 중"}
                      {" • "}
                      {new Date(asset.createdAt!).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(asset.status || "pending")}`}></div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAsset(asset.id, asset.title);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-100 text-red-500 hover:text-red-700 transition-all"
                      disabled={deleteAssetMutation.isPending}
                      title="자료 삭제"
                    >
                      <i className="fas fa-trash text-xs"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Templates Section */}
      <div className="p-4 border-t border-gray-100">
        <Button
          onClick={onOpenTemplateModal}
          className="w-full"
        >
          <i className="fas fa-plus mr-2"></i>
          템플릿 불러오기
        </Button>
      </div>
    </div>
  );
}
