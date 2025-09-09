"use client";

import { useCallback, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/Ui/data-display";
import { Button } from "@/components/Ui/buttons";
import { Input, Label, Textarea } from "@/components/Ui/form-controls";
import { createToastMessage } from "@/lib/messages/toast-utils";
import { useToast } from "@/hooks/use-toast";

interface TextUploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  canvasId: string;
  isGlobalKnowledge?: boolean;
  onComplete?: (data: any) => void;
}

/**
 * TextUploadModal - 사용자가 직접 텍스트(최대 10,000자)를 지식으로 업로드하는 모달
 * 
 * 주요 역할:
 * 1. 제목 + 본문 텍스트 입력을 받아 서버 API에 업로드
 * 2. 글자수(현재/최대) 카운트를 하단에 표시하고 제한 초과 방지
 * 3. 업로드 완료 후 모달 닫기 및 성공 토스트 표시
 * 
 * 핵심 특징:
 * - 10,000자 하드 제한. 입력 시 즉시 잘라내어 초과 저장 방지
 * - 저장 중 버튼 로딩 처리로 중복 제출 방지
 * - Sidebar의 "업로드된 자료" 리스트는 Realtime으로 자동 갱신됨
 */
export default function TextUploadModal({ open, onOpenChange, workspaceId, canvasId, isGlobalKnowledge = false, onComplete }: TextUploadModalProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState<string>("텍스트 자료");
  const [content, setContent] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const MAX_CHARS = 10000;
  const charCount = content.length;
  const isOverLimit = charCount > MAX_CHARS;

  const remaining = useMemo(() => Math.max(0, MAX_CHARS - charCount), [charCount]);

  const handleChangeContent = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value || "";
    // 하드 제한: 초과 입력은 잘라냄
    setContent(value.slice(0, MAX_CHARS));
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!content.trim()) {
      toast({ title: "내용을 입력하세요.", variant: "destructive" });
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const endpoint = isGlobalKnowledge
        ? `/api/admin/global-knowledge`
        : `/api/workspaces/${workspaceId}/assets`;
      const payload = isGlobalKnowledge
        ? { type: 'text', title: title?.trim() || '텍스트 자료', content }
        : { type: 'text', title: title?.trim() || '텍스트 자료', canvasId, metaJson: { source: 'text', contentLength: content.length }, url: null, content };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        // 서버의 무료 플랜 제한 메시지(JSON)도 텍스트로 노출되도록 처리
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

      const successMessage = createToastMessage.uploadSuccess("TEXT");
      toast(successMessage);
      setContent("");
      setTitle("텍스트 자료");
      onOpenChange(false);
      onComplete?.(await response.json().catch(() => null));
    } catch (error) {
      // 서버가 무료 플랜 제한 메시지를 내려주면 그대로 표시
      const raw = error instanceof Error ? error.message : String(error || '업로드에 실패했습니다.');
      let msg = raw;
      try {
        const start = raw.indexOf('{');
        const end = raw.lastIndexOf('}');
        if (start !== -1 && end !== -1 && end > start) {
          const obj = JSON.parse(raw.slice(start, end + 1));
          msg = obj?.error || obj?.message || raw;
        }
      } catch {}
      toast({ title: '업로드 실패', description: msg, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }, [workspaceId, canvasId, content, title, isSubmitting, toast, onOpenChange, isGlobalKnowledge, onComplete]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>텍스트 지식 업로드</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="text-title" className="text-sm font-medium text-foreground">제목</Label>
            <Input id="text-title" value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" placeholder="예: 고객 리뷰 모음" />
          </div>

          <div>
            <Label htmlFor="text-content" className="text-sm font-medium text-foreground">여기에 텍스트를 붙여넣으세요.</Label>
            <Textarea
              id="text-content"
              value={content}
              onChange={handleChangeContent}
              placeholder="최대 10,000자까지 입력 가능합니다."
              className="mt-1 h-64 resize-y"
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className={`text-muted-foreground ${isOverLimit ? "text-red-600" : ""}`}>글자 수: {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}</span>
              <span className="text-muted-foreground">남은 글자: {remaining.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-1">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>취소</Button>
            <Button onClick={handleSubmit} disabled={isSubmitting || charCount === 0}>{isSubmitting ? "삽입 중..." : "삽입"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


