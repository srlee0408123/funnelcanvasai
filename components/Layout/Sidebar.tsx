import { Button } from "@/components/Ui/buttons";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { 
  FileText, 
  Link2, 
  File, 
  Brain, 
  X, 
  Save, 
  Copy, 
  Trash2, 
  ChevronLeft, 
  Users, 
  Upload, 
  Plus,
  Play,
  Circle,
  Square,
  Triangle,
  Hexagon
} from "lucide-react";

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
  onAddNode?: (nodeType: string) => void;
  assets: Asset[];
  workspaceId: string;
  workspaceName?: string;
  selectedNode?: Node | null;
  showNodeDetails?: boolean;
  onCloseNodeDetails?: () => void;
  onAssetDeleted?: (assetId: string) => void;
}

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  onOpenUploadModal,
  onOpenTemplateModal,
  onOpenMembersModal,
  onAddNode,
  assets,
  workspaceId,
  workspaceName,
  selectedNode,
  showNodeDetails = false,
  onCloseNodeDetails,
  onAssetDeleted,
}: SidebarProps) {
  const { toast } = useToast();

  // Delete asset mutation
  const deleteAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      await apiRequest("DELETE", `/api/assets/${assetId}`);
      return assetId;
    },
    onSuccess: (_data, variables) => {
      // Optimistic UI update via parent callback
      if (variables) {
        onAssetDeleted?.(variables);
      }
      // Keep existing invalidation for any consumers using React Query elsewhere
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

  /**
   * 유튜브 자료 카드 클릭 시 해당 영상 URL로 연결
   * 새 탭에서 열어 사용자 경험 향상
   */
  const handleAssetClick = (asset: Asset) => {
    if (asset.type === "youtube" && asset.url) {
      window.open(asset.url, "_blank", "noopener,noreferrer");
    }
  };
  const getAssetIcon = (type: string) => {
    switch (type) {
      case "pdf":
        return <FileText className="h-4 w-4 text-red-500" />;
      case "youtube":
        return <Play className="h-4 w-4 text-red-600" />;
      case "url":
        return <Link2 className="h-4 w-4 text-blue-500" />;
      case "text":
        return <FileText className="h-4 w-4 text-green-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
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
            className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center"
          >
            <Brain className="h-4 w-4 text-primary-foreground" />
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
                <h1 className="font-semibold text-foreground">{selectedNode.data.title}</h1>
                <p className="text-xs text-muted-foreground">노드 세부 설정</p>
              </div>
            </div>
            <button 
              onClick={onCloseNodeDetails}
              className="p-1 rounded-md hover:bg-gray-100 transition-colors"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Node Details Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Basic Info */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">노드 제목</label>
              <input 
                type="text" 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                defaultValue={selectedNode.data.title}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">설명</label>
              <textarea 
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-20"
                defaultValue={selectedNode.data.subtitle || ""}
                placeholder="노드에 대한 설명을 입력하세요"
              />
            </div>

            {/* Position Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-foreground mb-2">위치 정보</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div>X: {Math.round(selectedNode.position.x)}</div>
                <div>Y: {Math.round(selectedNode.position.y)}</div>
              </div>
            </div>

            {/* Node Type Info */}
            <div className="bg-gray-50 p-3 rounded-lg">
              <h4 className="text-sm font-medium text-foreground mb-2">노드 타입</h4>
              <div className="text-sm text-muted-foreground">{selectedNode.type}</div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 space-y-2">
              <Button className="w-full" variant="outline">
                <Save className="h-4 w-4 mr-2" />
                변경사항 저장
              </Button>
              <Button className="w-full" variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                노드 복사
              </Button>
              <Button className="w-full" variant="destructive">
                <Trash2 className="h-4 w-4 mr-2" />
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
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">두더지 AI</h1>
              <p className="text-xs text-muted-foreground">Creator Canvas</p>
            </div>
          </div>
          <button
            onClick={onToggleCollapse}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Upload Section */}
      <div className="p-4 border-b border-gray-100">
        <h3 className="font-medium text-foreground mb-3">지식 업로드</h3>
        <div className="space-y-2">
          <button
            onClick={() => onOpenUploadModal("pdf")}
            className="w-full p-3 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <FileText className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">PDF 문서 업로드</span>
            </div>
          </button>
          
          <button
            onClick={() => onOpenUploadModal("youtube")}
            className="w-full p-3 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <Play className="h-4 w-4 text-red-600" />
              <span className="text-sm text-muted-foreground">유튜브 영상 링크</span>
            </div>
          </button>
          
          <button
            onClick={() => onOpenUploadModal("url")}
            className="w-full p-3 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <Link2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">웹사이트 URL</span>
            </div>
          </button>
        </div>
      </div>
      {/* Workspace Management */}
      {onOpenMembersModal && (
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-medium text-foreground mb-3">워크스페이스 관리</h3>
          <button
            onClick={onOpenMembersModal}
            className="w-full p-3 border-2 border-dashed border-border rounded-lg hover:border-primary hover:bg-accent transition-colors text-left"
          >
            <div className="flex items-center space-x-3">
              <Users className="h-4 w-4 text-orange-500" />
              <span className="text-sm text-muted-foreground">멤버 관리</span>
            </div>
          </button>
        </div>
      )}



      {/* Assets List */}
      <div className="flex-1 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-foreground">업로드된 자료</h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-full">
            {assets.length}개
          </span>
        </div>
        
        {assets.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Upload className="h-4 w-4 text-gray-400" />
            </div>
            <p className="text-sm text-muted-foreground">업로드된 자료가 없습니다</p>
          </div>
        ) : (
          <div className="space-y-2">
            {assets.map((asset) => (
              <div
                key={asset.id}
                onClick={() => handleAssetClick(asset)}
                className={`group p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors ${
                  asset.type === "youtube" && asset.url 
                    ? "cursor-pointer hover:border-blue-300 hover:shadow-sm" 
                    : ""
                }`}
                title={asset.type === "youtube" && asset.url ? "클릭하여 유튜브 영상 보기" : undefined}
              >
                <div className="flex items-start space-x-3">
                  <div className="mt-1">{getAssetIcon(asset.type)}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {asset.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
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
                      <Trash2 className="h-3 w-3" />
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
          <Plus className="h-4 w-4 mr-2" />
          템플릿 불러오기
        </Button>
      </div>
    </div>
  );
}
