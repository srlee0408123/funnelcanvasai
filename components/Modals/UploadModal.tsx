/**
 * UploadModal - 업로드 종류에 따라 전용 모달로 위임하는 라우터 컴포넌트
 * 
 * 주요 역할:
 * 1. 업로드 타입(pdf/youtube/url)에 맞는 전용 모달로 렌더링 위임
 * 2. 미지정/알 수 없는 타입의 경우 기본 모달 래퍼 표시
 * 
 * 핵심 특징:
 * - 단일 책임 원칙 강화: 실제 업로드 로직은 각 전용 모달로 분리
 * - 유지보수성 향상: 기능별 컴포넌트가 독립적으로 진화 가능
 * - 기존 API 유지: 부모 컴포넌트의 사용법 변경 없이 내부 위임 처리
 * 
 * 주의사항:
 * - `uploadType`은 "pdf" | "youtube" | "url" | null 값을 가짐
 * - 각 전용 모달은 동일한 `open`, `onOpenChange`, `workspaceId`, `canvasId` props를 사용
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/Ui/data-display";
import PdfUploadModal from "@/components/Modals/PdfUploadModal";
import YoutubeUploadModal from "@/components/Modals/YoutubeUploadModal";
import ScrapingUploadModal from "@/components/Modals/ScrapingUploadModal";

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadType: "pdf" | "youtube" | "url" | null;
  workspaceId: string;
  canvasId: string;
}

export default function UploadModal({ open, onOpenChange, uploadType, workspaceId, canvasId }: UploadModalProps) {
  if (uploadType === "pdf") {
    return <PdfUploadModal open={open} onOpenChange={onOpenChange} workspaceId={workspaceId} canvasId={canvasId} />;
  }
  if (uploadType === "youtube") {
    return <YoutubeUploadModal open={open} onOpenChange={onOpenChange} workspaceId={workspaceId} canvasId={canvasId} />;
  }
  if (uploadType === "url") {
    return <ScrapingUploadModal open={open} onOpenChange={onOpenChange} workspaceId={workspaceId} canvasId={canvasId} />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>자료 업로드</DialogTitle>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
