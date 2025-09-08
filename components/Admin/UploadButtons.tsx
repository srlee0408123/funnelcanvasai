"use client";

import { Button } from "@/components/Ui/buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Ui/layout";
import { 
  Upload, 
  FileText, 
  Play, 
  Link2, 
  Brain
} from "lucide-react";

/**
 * UploadButtons.tsx - 글로벌 지식 업로드를 위한 4열 버튼 그리드 컴포넌트
 * 
 * 주요 역할:
 * 1. PDF, YouTube, URL, Text 업로드 버튼을 4열 그리드로 배치
 * 2. 각 버튼 클릭 시 해당 타입의 업로드 모달 열기
 * 3. 시각적으로 구분되는 아이콘과 설명 제공
 * 
 * 핵심 특징:
 * - 반응형 그리드 레이아웃 (모바일 1열, 태블릿 2열, 데스크톱 4열)
 * - 타입별 고유 아이콘과 색상으로 직관적 구분
 * - 호버 효과로 사용자 인터랙션 피드백
 * 
 * 주의사항:
 * - 각 버튼은 부모 컴포넌트의 핸들러 함수를 호출
 * - 접근성을 고려한 버튼 레이블과 설명 제공
 */

interface UploadButtonsProps {
  onOpenUploadModal: (type: "pdf" | "youtube" | "url" | "text") => void;
}

export default function UploadButtons({ onOpenUploadModal }: UploadButtonsProps) {
  /**
   * 업로드 타입별 설정 정보
   * 아이콘, 색상, 제목, 설명을 통합 관리
   */
  const uploadTypes = [
    {
      type: "pdf" as const,
      icon: FileText,
      iconColor: "text-red-600",
      bgColor: "bg-red-100",
      hoverBgColor: "group-hover:bg-red-200",
      title: "PDF 문서",
      description: "업로드",
      label: "PDF 문서 업로드"
    },
    {
      type: "youtube" as const,
      icon: Play,
      iconColor: "text-red-600",
      bgColor: "bg-red-100",
      hoverBgColor: "group-hover:bg-red-200",
      title: "유튜브 영상",
      description: "링크 추가",
      label: "유튜브 영상 링크 추가"
    },
    {
      type: "url" as const,
      icon: Link2,
      iconColor: "text-blue-600",
      bgColor: "bg-blue-100",
      hoverBgColor: "group-hover:bg-blue-200",
      title: "웹사이트",
      description: "URL 추가",
      label: "웹사이트 URL 추가"
    },
    {
      type: "text" as const,
      icon: FileText,
      iconColor: "text-green-600",
      bgColor: "bg-green-100",
      hoverBgColor: "group-hover:bg-green-200",
      title: "텍스트",
      description: "직접 입력",
      label: "텍스트 직접 입력"
    }
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Upload className="h-5 w-5 mr-2 text-purple-600" />
          새 지식 추가
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {uploadTypes.map(({ 
            type, 
            icon: Icon, 
            iconColor, 
            bgColor, 
            hoverBgColor, 
            title, 
            description, 
            label 
          }) => (
            <button
              key={type}
              onClick={() => onOpenUploadModal(type)}
              className={`p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-left group`}
              aria-label={label}
            >
              <div className="flex flex-col items-center space-y-3">
                {/* 아이콘 영역 */}
                <div className={`w-12 h-12 ${bgColor} rounded-lg flex items-center justify-center ${hoverBgColor} transition-colors`}>
                  <Icon className={`h-6 w-6 ${iconColor}`} />
                </div>
                
                {/* 텍스트 영역 */}
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">{title}</p>
                  <p className="text-xs text-gray-500">{description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
