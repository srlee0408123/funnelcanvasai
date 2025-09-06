import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/Ui/data-display";
import { Button } from "@/components/Ui/buttons";
import { Input, Label } from "@/components/Ui/form-controls";
import { useToast } from "@/hooks/use-toast";
import { queryClient, invalidateCanvasQueries } from "@/lib/queryClient";
import { createToastMessage, ErrorDetectors } from "@/lib/messages/toast-utils";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * YoutubeUploadModal - 유튜브 영상 전사/지식 업로드 전용 모달
 * 
 * 주요 역할:
 * 1. 유튜브 URL 유효성 검사
 * 2. Supabase Edge Function 호출로 전사 및 청크 저장
 * 3. 중복/자막없음 등의 에러 케이스 처리 및 사용자 피드백 제공
 * 
 * 핵심 특징:
 * - Edge Function("youtube-transcript-ingest")를 통한 비동기 처리
 * - 중복 영상/자막 미제공 등의 명확한 에러 메시지 제공
 * - 업로드 성공 시 자산 목록 자동 갱신을 위한 캐시 무효화
 * 
 * 주의사항:
 * - 유효한 유튜브 URL만 허용
 * - 전사/처리에 시간이 소요될 수 있음
 * - 비로그인 상태는 자동 로그인 유도
 */
interface YoutubeUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  canvasId: string;
}

export default function YoutubeUploadModal({ open, onOpenChange, workspaceId, canvasId }: YoutubeUploadModalProps) {
  const { toast } = useToast();
  const [url, setUrl] = useState("");

  const isValidYouTubeUrl = (value: string) => {
    const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)/;
    return youtubeRegex.test(value);
  };

  const resetForm = () => {
    setUrl("");
  };

  /**
   * Supabase Edge Function 오류 메시지 추출
   * - 우선순위: context.status, body/message 내 JSON(code/message)
   */
  function extractFunctionErrorMessage(raw: unknown): string {
    const fallback = "요청 처리 중 오류가 발생했습니다.";
    const err = (raw as any) || {};
    const status: number | undefined = err?.context?.status ?? err?.status;
    const basis = err?.context?.body ?? err?.body ?? err?.message ?? String(err);

    let payload: any = null;
    if (typeof basis === "string") {
      const trimmed = basis.trim();
      try {
        payload = JSON.parse(trimmed);
      } catch {
        const start = trimmed.indexOf("{");
        const end = trimmed.lastIndexOf("}");
        if (start !== -1 && end !== -1 && end > start) {
          try { payload = JSON.parse(trimmed.slice(start, end + 1)); } catch { /* noop */ }
        }
      }
    } else if (basis && typeof basis === "object") {
      payload = basis;
    }

    const code: string | undefined = payload?.code ?? payload?.errorCode;
    const msgRaw = payload?.error ?? payload?.message ?? payload?.msg ?? err?.message ?? fallback;
    const msg = String(msgRaw ?? fallback);

    if (status === 409 || code === "duplicate" || /duplicate|409/i.test(msg)) {
      return "해당 유튜브 영상은 이미 저장되어 있습니다.";
    }
    return msg.trim() || fallback;
  }

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!url || !isValidYouTubeUrl(url)) {
        throw new Error("Invalid YouTube URL");
      }
      const supabase = createSupabaseBrowserClient();
      const { data, error } = await supabase.functions.invoke("youtube-transcript-ingest", {
        body: {
          canvasId,
          youtubeUrl: url,
          title: url,
          chunk: { enabled: true, maxTokens: 1000, overlapTokens: 120 },
        },
      });

      if (error) {
        // 함수 에러(비 2xx)에서도 서버의 JSON 메시지를 최대한 복구하여 사용자에게 전달
        const friendly = extractFunctionErrorMessage(error);
        throw new Error(friendly);
      }

      if (!data?.success) {
        throw new Error(data?.error || "요청 처리 중 오류가 발생했습니다.");
      }

      return data;
    },
    onSuccess: async () => {
      await invalidateCanvasQueries({ canvasId, workspaceId, client: queryClient, targets: ["assets", "knowledge"] });
      const successMessage = createToastMessage.uploadSuccess('YOUTUBE');
      toast(successMessage);
      onOpenChange(false);
      setUrl("");
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
      
      const errorMessage = createToastMessage.uploadError(error, 'youtube');
      toast(errorMessage);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>유튜브 영상 업로드</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">영상의 자막과 설명을 자동으로 추출합니다.</p>

          <div>
            <Label htmlFor="youtube-url" className="text-sm font-medium text-foreground">유튜브 URL</Label>
            <Input 
              id="youtube-url" 
              type="url" 
              value={url} 
              onChange={(e) => setUrl(e.target.value)} 
              placeholder="https://www.youtube.com/watch?v=... 또는 https://youtu.be/..." 
              className="mt-1" 
            />
            {url && !isValidYouTubeUrl(url) && (
              <p className="text-xs text-red-600 mt-1">올바른 YouTube URL을 입력해주세요. 예: https://youtube.com/watch?v=...</p>
            )}
          </div>
        </div>

        <div className="flex space-x-3 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploadMutation.isPending} className="flex-1">취소</Button>
          <Button onClick={() => uploadMutation.mutate()} disabled={!isValidYouTubeUrl(url) || uploadMutation.isPending} className="flex-1">
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