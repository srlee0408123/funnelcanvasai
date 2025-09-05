import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/Ui/data-display";
import { Button } from "@/components/Ui/buttons";
import { Input, Label } from "@/components/Ui/form-controls";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";

/**
 * ScrapingUploadModal - 웹사이트 URL 스크래핑 업로드 전용 모달
 * 
 * 주요 역할:
 * 1. 일반 URL 유효성 검사 및 제목 입력
 * 2. 서버 API 호출을 통한 크롤링/지식 저장 트리거
 * 3. 성공/실패에 따른 사용자 피드백 제공
 * 
 * 핵심 특징:
 * - 표준 URL 유효성 검사(new URL 이용)
 * - 업로드 성공 시 React Query 캐시 무효화로 목록 갱신
 * - 비로그인 상태(401) 자동 로그인 유도
 * 
 * 주의사항:
 * - 서버 엔드포인트: `/api/workspaces/{workspaceId}/assets`
 * - payload의 type은 "url" 유지 (백엔드 호환)
 */
interface ScrapingUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  canvasId: string;
}

export default function ScrapingUploadModal({ open, onOpenChange, workspaceId, canvasId }: ScrapingUploadModalProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const isValidUrl = (value: string) => {
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  };

  const resetForm = () => {
    setUrl("");
    setTitle("");
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!url || !isValidUrl(url)) {
        throw new Error("Invalid URL");
      }
      const res = await apiRequest("POST", `/api/workspaces/${workspaceId}/assets`, {
        type: "url",
        title: title || url,
        url: url,
        canvasId: canvasId,
        metaJson: { originalUrl: url },
      });
      // 정상 응답 본문을 그대로 반환
      try {
        return await res.json();
      } catch {
        return null;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workspaces", workspaceId, "assets"] });
      toast({ title: "업로드 완료", description: "자료가 성공적으로 업로드되어 처리되었습니다." });
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({ title: "Unauthorized", description: "You are logged out. Logging in again...", variant: "destructive" });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      // 스크래핑 업로드는 일반화된 메시지 사용 (YouTube 에러와 분리)
      toast({ title: "업로드 실패", description: "자료 업로드에 실패했습니다. 다시 시도해주세요.", variant: "destructive" });
    },
  });

  const canSubmit = () => {
    return Boolean(url.trim()) && isValidUrl(url) && Boolean(title.trim());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>웹사이트 URL 업로드</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">웹페이지의 텍스트 내용을 자동으로 추출합니다.</p>

          <div>
            <Label htmlFor="title" className="text-sm font-medium text-foreground">제목</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="자료의 제목을 입력하세요" className="mt-1" />
          </div>

          <div>
            <Label htmlFor="website-url" className="text-sm font-medium text-foreground">웹사이트 URL</Label>
            <Input id="website-url" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" className="mt-1" />
            {url && !isValidUrl(url) && (
              <p className="text-xs text-red-600 mt-1">올바른 URL을 입력해주세요.</p>
            )}
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


