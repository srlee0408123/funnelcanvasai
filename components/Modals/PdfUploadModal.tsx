import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/Ui/data-display";
import { Button } from "@/components/Ui/buttons";
import { Input, Label } from "@/components/Ui/form-controls";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { createToastMessage, ErrorDetectors } from "@/lib/messages/toast-utils";

/**
 * PdfUploadModal - PDF 파일 업로드 전용 모달
 * 
 * 주요 역할:
 * 1. PDF 파일 선택 및 유효성 검사
 * 2. FormData를 사용한 서버 업로드 처리
 * 3. 업로드 성공/실패에 대한 사용자 피드백 제공
 * 
 * 핵심 특징:
 * - 10MB 이하의 PDF만 허용하는 클라이언트 유효성 검사
 * - 업로드 성공 시 React Query 캐시 무효화로 목록 자동 갱신
 * - 비로그인 상태(401) 감지 시 자동 로그인 유도
 * 
 * 주의사항:
 * - 서버 엔드포인트: `/api/workspaces/{workspaceId}/upload-pdf`
 * - 업로드 도중 중복 클릭 방지 위해 버튼 상태 관리 필수
 * - 대용량 파일 업로드 시 네트워크 상태에 따라 시간이 소요될 수 있음
 */
interface PdfUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  canvasId: string;
}

export default function PdfUploadModal({ open, onOpenChange, workspaceId, canvasId }: PdfUploadModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const resetForm = () => {
    setTitle("");
    setSelectedFile(null);
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error("No file selected");
      }

      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", title || selectedFile.name);
      formData.append("workspaceId", workspaceId);
      formData.append("canvasId", canvasId);

      const response = await fetch(`/api/workspaces/${workspaceId}/upload-pdf`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let msg = response.statusText;
        try {
          const t = await response.text();
          if (t) {
            try {
              const j = JSON.parse(t);
              msg = j?.error || j?.message || t;
            } catch {
              msg = t;
            }
          }
        } catch {}
        throw new Error(msg || `HTTP ${response.status}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "assets"] });
      const successMessage = createToastMessage.uploadSuccess('PDF');
      toast(successMessage);
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      if (ErrorDetectors.isUnauthorizedError(error)) {
        const authMessage = createToastMessage.authError(error);
        toast(authMessage);
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      
      const errorMessage = createToastMessage.uploadError(error, 'pdf');
      toast(errorMessage);
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      const errorMessage = createToastMessage.fileValidationError('TYPE');
      toast(errorMessage);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      const errorMessage = createToastMessage.fileValidationError('SIZE');
      toast(errorMessage);
      return;
    }
    setSelectedFile(file);
    if (!title) {
      setTitle(file.name.replace(".pdf", ""));
    }
  };

  const canSubmit = () => {
    return Boolean(selectedFile) && Boolean(title.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>PDF 문서 업로드</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">PDF 파일의 텍스트를 자동으로 추출하여 분석합니다.</p>

          <div>
            <Label htmlFor="title" className="text-sm font-medium text-foreground">제목</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="자료의 제목을 입력하세요" className="mt-1" />
          </div>

          <div>
            <Label className="text-sm font-medium text-foreground">PDF 파일</Label>
            <div className="mt-1 border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
              {selectedFile ? (
                <div>
                  <i className="fas fa-file-pdf text-red-500 text-2xl mb-2"></i>
                  <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  <button onClick={() => setSelectedFile(null)} className="text-xs text-primary hover:text-primary/80 mt-1">다른 파일 선택</button>
                </div>
              ) : (
                <div>
                  <i className="fas fa-cloud-upload-alt text-gray-400 text-2xl mb-2"></i>
                  <p className="text-muted-foreground mb-2">PDF 파일을 드래그하거나 클릭하여 업로드</p>
                  <p className="text-xs text-muted-foreground mb-3">최대 10MB</p>
                  <input type="file" accept=".pdf" onChange={handleFileSelect} className="hidden" id="pdf-file-input" />
                  <Button type="button" variant="outline" onClick={() => document.getElementById("pdf-file-input")?.click()}>
                    파일 선택
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploadMutation.isPending} className="flex-1">취소</Button>
          <Button onClick={() => uploadMutation.mutate()} disabled={!canSubmit() || uploadMutation.isPending} className="flex-1">
            {uploadMutation.isPending ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>처리 중...</span>
              </div>
            ) : (
              "업로드"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


