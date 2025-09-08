"use client";

import { useState } from "react";
import { Button } from "@/components/Ui/buttons";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/Ui/data-display";
import { Textarea } from "@/components/Ui/form-controls";
import { 
  Brain, 
  Trash2, 
  ExternalLink,
  Calendar,
  Tag,
  FileText,
  Play,
  Link2,
  File
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

/**
 * KnowledgeList.tsx - 글로벌 지식 목록을 리스트 형태로 표시하는 컴포넌트
 * 
 * 주요 역할:
 * 1. 글로벌 지식 목록을 리스트 형태로 표시
 * 2. 각 지식의 제목, 내용 미리보기, 태그, 메타 정보 표시
 * 3. 삭제 기능 제공 (호버 시에만 표시)
 * 4. 클릭 시 사이드바와 동일한 동작 (새 탭 또는 모달)
 * 
 * 핵심 특징:
 * - 컴팩트한 리스트 레이아웃으로 공간 효율성 극대화
 * - 그룹 호버 효과로 삭제 버튼 표시
 * - 로딩 상태와 빈 상태 처리
 * - URL 타입별 아이콘과 클릭 동작 구분
 * 
 * 주의사항:
 * - 삭제 시 확인 다이얼로그 표시
 * - API 호출은 부모 컴포넌트에서 처리
 * - 클릭 이벤트 전파 방지로 삭제 버튼과 구분
 */

interface GlobalKnowledge {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  sourceUrl?: string;
  createdAt: string;
}

interface KnowledgeListProps {
  knowledgeList: GlobalKnowledge[] | null | undefined;
  isLoading: boolean;
  onDelete: (id: string) => void;
}

export default function KnowledgeList({ 
  knowledgeList, 
  isLoading, 
  onDelete 
}: KnowledgeListProps) {
  const { toast } = useToast();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewContent, setPreviewContent] = useState("");

  /**
   * URL에서 소스 타입을 추론하는 함수
   * 유튜브, PDF, 일반 웹사이트 등을 구분
   */
  const getSourceType = (sourceUrl?: string): "youtube" | "pdf" | "url" | "text" => {
    if (!sourceUrl) return "text";
    
    const url = sourceUrl.toLowerCase();
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
    if (url.includes(".pdf") || url.includes("pdf")) return "pdf";
    return "url";
  };

  /**
   * 지식 클릭 핸들러
   * 사이드바와 동일한 동작: 유튜브/URL/PDF는 새 탭, 텍스트는 모달
   */
  const handleKnowledgeClick = async (knowledge: GlobalKnowledge) => {
    const sourceType = getSourceType(knowledge.sourceUrl);
    
    // 유튜브/URL/PDF는 원본 링크를 새 탭에서 열기
    if ((sourceType === "youtube" || sourceType === "url" || sourceType === "pdf") && knowledge.sourceUrl) {
      window.open(knowledge.sourceUrl, "_blank", "noopener,noreferrer");
      return;
    }
    
    // 텍스트 자료는 모달로 본문 미리보기 제공
    setPreviewTitle(knowledge.title);
    setPreviewContent(knowledge.content);
    setPreviewOpen(true);
  };

  /**
   * 지식 삭제 핸들러
   * 확인 다이얼로그 후 부모 컴포넌트의 삭제 함수 호출
   */
  const handleDelete = (id: string, title: string) => {
    if (confirm(`"${title}" 지식을 정말 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다.`)) {
      onDelete(id);
    }
  };

  /**
   * 로딩 상태 렌더링
   * 스켈레톤 UI로 사용자 경험 향상
   */
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-16 bg-gray-200 rounded-lg"></div>
          </div>
        ))}
      </div>
    );
  }

  /**
   * 빈 상태 렌더링
   * 사용자에게 명확한 안내 제공
   */
  if (!Array.isArray(knowledgeList) || knowledgeList.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Brain className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">지식이 없습니다</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          위의 업로드 버튼을 사용하여 첫 번째 글로벌 지식을 추가해보세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {(Array.isArray(knowledgeList) ? knowledgeList : []).map((knowledge) => (
        <div
          key={knowledge.id}
          onClick={() => handleKnowledgeClick(knowledge)}
          className={`flex items-start space-x-4 p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group cursor-pointer ${
            knowledge.sourceUrl 
              ? "hover:border-blue-300 hover:shadow-sm" 
              : ""
          }`}
          title={
            knowledge.sourceUrl
              ? getSourceType(knowledge.sourceUrl) === "youtube"
                ? "클릭하여 유튜브 영상 보기"
                : getSourceType(knowledge.sourceUrl) === "pdf"
                  ? "클릭하여 PDF 문서 보기"
                  : "클릭하여 원본 링크 열기"
              : "클릭하여 내용 보기"
          }
        >
          {/* 아이콘 영역 */}
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              {knowledge.sourceUrl ? (
                (() => {
                  const sourceType = getSourceType(knowledge.sourceUrl);
                  switch (sourceType) {
                    case "youtube":
                      return <Play className="h-5 w-5 text-red-600" />;
                    case "pdf":
                      return <FileText className="h-5 w-5 text-red-500" />;
                    case "url":
                      return <Link2 className="h-5 w-5 text-blue-500" />;
                    default:
                      return <Brain className="h-5 w-5 text-purple-600" />;
                  }
                })()
              ) : (
                <Brain className="h-5 w-5 text-purple-600" />
              )}
            </div>
          </div>

          {/* 내용 영역 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* 제목 */}
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {knowledge.title}
                </h3>
                
                {/* 태그 표시 */}
                {knowledge.tags && knowledge.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {knowledge.tags.map((tag, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full flex items-center"
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* 메타 정보 */}
                <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center">
                    <Calendar className="h-3 w-3 mr-1" />
                    {new Date(knowledge.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* 삭제 버튼 - 호버 시에만 표시 */}
              <div className="flex-shrink-0 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(knowledge.id, knowledge.title);
                  }}
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 opacity-0 group-hover:opacity-100 transition-all"
                  title="지식 삭제"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
      
      {/* 미리보기 모달 */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{previewTitle || "텍스트 자료"}</DialogTitle>
          </DialogHeader>
          <div>
            <Textarea value={previewContent} readOnly className="h-72" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}