"use client";

/**
 * PromptLogsModal.tsx - 온보딩 프롬프트 변경 이력 모달 (읽기 전용)
 * 
 * 주요 역할:
 * 1. 온보딩 전용 로그(onboarding_prompt_logs)를 조회하여 목록/미리보기 제공
 * 2. 복원 기능은 제공하지 않으며, 되돌리기는 기본 프롬프트 버튼에서 처리
 * 
 * 핵심 특징:
 * - React Query를 사용해 로그를 비동기 로드하고 로딩/에러 상태를 처리
 * - 대용량 텍스트를 스크롤 가능한 영역으로 미리보기
 * - 대용량 텍스트 스크롤 미리보기
 * 
 * 주의사항:
 * - 복원 기능 미제공 (읽기 전용)
 */

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/Ui/buttons";

export default function PromptLogsModal({
  open,
  promptName,
  onClose,
  limit = 20,
}: {
  open: boolean;
  promptName?: string;
  onClose: () => void;
  limit?: number;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const isOpen = Boolean(open);

  const {
    data: logs = [],
    isLoading,
    isError,
    refetch,
  } = useQuery<any[]>({
    queryKey: ["/api/admin/onboarding-logs", limit],
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/onboarding-logs?limit=${Math.max(1, Math.min(50, limit))}`
      );
      const json = await res.json();
      return Array.isArray(json?.data) ? json.data : [];
    },
    enabled: isOpen,
  });

  const selectedLog = useMemo(() => logs.find((l: any) => String(l.id) === String(previewId)), [logs, previewId]);

  // 읽기 전용: 복원 기능 없음

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">프롬프트 변경 로그</h3>
            <p className="text-xs text-gray-500 mt-0.5">{promptName || "(이름 없음)"}</p>
          </div>
          <div className="space-x-2">
            <Button variant="outline" size="sm" onClick={onClose}>닫기</Button>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">최근 변경 이력</span>
              {isLoading && <span className="text-xs text-gray-500">불러오는 중...</span>}
              {isError && <span className="text-xs text-red-600">로딩 실패</span>}
            </div>
            <div className="border rounded-md divide-y max-h-[420px] overflow-y-auto bg-white">
              {Array.isArray(logs) && logs.length > 0 ? (
                logs.map((log: any) => (
                  <div key={log.id} className="p-3 text-xs text-gray-800">
                    <div className="flex items-center justify-between">
                      <div className="space-x-2">
                        <span className="font-medium">{new Date(log.changed_at).toLocaleString("ko-KR")}</span>
                        <span className="text-gray-500">by {log.changed_by || "system"}</span>
                      </div>
                      <div className="space-x-2">
                        <Button variant="outline" size="sm" onClick={() => setPreviewId(String(log.id))}>미리보기</Button>
                      </div>
                    </div>
                    {previewId === String(log.id) && (
                      <div className="mt-2 grid grid-cols-1 gap-2">
                        <div>
                          <div className="text-[11px] text-gray-500 mb-1">저장된 내용</div>
                          <pre className="whitespace-pre-wrap bg-gray-50 rounded p-2 max-h-72 overflow-y-auto">{String(selectedLog?.content ?? log.content ?? "")}</pre>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-4 text-xs text-gray-500">로그가 없습니다.</div>
              )}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">선택한 로그 미리보기</span>
              <Button variant="outline" size="sm" onClick={() => setPreviewId(null)}>초기화</Button>
            </div>
            <div className="border rounded-md bg-gray-50 p-3 min-h-[420px] max-h-[420px] overflow-y-auto">
              {!previewId ? (
                <div className="text-xs text-gray-500">좌측에서 &quot;미리보기&quot;를 클릭하세요.</div>
              ) : selectedLog ? (
                <div className="space-y-3 text-xs">
                  <div className="text-gray-600">{new Date(selectedLog.changed_at).toLocaleString("ko-KR")} · by {selectedLog.changed_by || "system"}</div>
                  <div>
                    <div className="text-[11px] text-gray-500 mb-1">저장된 내용</div>
                    <pre className="whitespace-pre-wrap bg-white rounded p-2">{String(selectedLog.content || "")}</pre>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-gray-500">선택된 로그가 없습니다.</div>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-3 border-t flex items-center justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>닫기</Button>
        </div>
      </div>
    </div>
  );
}


