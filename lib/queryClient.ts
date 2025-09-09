import { QueryClient, QueryFunction } from "@tanstack/react-query";

/**
 * queryClient - React Query 클라이언트 및 공통 유틸 모음
 * 
 * 주요 역할:
 * 1. fetch 기반 apiRequest 헬퍼 제공(에러 처리 일관화)
 * 2. QueryClient 인스턴스 생성 및 기본 옵션 설정
 * 3. 캔버스 단위 캐시 무효화 헬퍼 제공(토글/읽기전용 키 포함)
 * 
 * 핵심 특징:
 * - 문자열/배열 형태의 queryKey 모두 지원하여 키 스타일 혼재 대응
 * - 공개(share/read-only) 뷰에서 사용하는 공개 키(`/api/public/canvas/...`)도 함께 무효화
 * - 필요 시 워크스페이스 자산 키까지 선택적으로 무효화 가능
 * 
 * 주의사항:
 * - 무효화는 exact: false로 부분 일치도 포함해 폭넓게 갱신 유도
 * - 필요 이상으로 과도한 무효화를 피하기 위해 targets로 범위 지정 권장
 */

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let raw = '';
    let message = res.statusText || 'Request failed';
    let code: string | undefined;
    let info: unknown;
    try {
      raw = await res.text();
      if (raw) {
        try {
          const json = JSON.parse(raw);
          info = json;
          message = (json as any)?.error || (json as any)?.message || raw;
          code = (json as any)?.code;
        } catch {
          // Fallback: extract JSON substring if prefixed with status text
          const start = raw.indexOf('{');
          const end = raw.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end > start) {
            try {
              const json = JSON.parse(raw.slice(start, end + 1));
              info = json;
              message = (json as any)?.error || (json as any)?.message || raw;
              code = (json as any)?.code;
            } catch {
              message = raw;
            }
          } else {
            message = raw;
          }
        }
      }
    } catch {
      // keep defaults
    }
    // Avoid attaching raw response body to error to reduce risk of leaking sensitive data
    const err: any = new Error(message);
    err.status = res.status;
    err.code = code;
    // Intentionally omit err.raw contents
    err.info = info;
    throw err;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    
    // Handle empty responses gracefully
    const text = await res.text();
    if (!text || text.trim() === '') {
      console.warn(`Empty response from ${queryKey.join("/")}`);
      return null;
    }
    
    try {
      return JSON.parse(text);
    } catch (error) {
      console.error(`JSON parse error for ${queryKey.join("/")}:`, error);
      // Do not log full response text to avoid leaking sensitive payloads
      throw new Error(`Invalid JSON response from ${queryKey.join("/")}`);
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export type CanvasQueryTarget =
  | "todos"
  | "knowledge"
  | "state"
  | "shares"
  | "memos"
  | "assets"
  | "all";

/**
 * invalidateCanvasQueries - 캔버스 관련 쿼리 키들을 일괄 무효화
 */
export async function invalidateCanvasQueries(params: {
  canvasId: string;
  workspaceId?: string;
  client?: QueryClient;
  targets?: CanvasQueryTarget[];
}): Promise<void> {
  const { canvasId, workspaceId, client, targets } = params;
  const qc = client || queryClient;

  const wants = new Set((targets && targets.length > 0 ? targets : ["all"]) as CanvasQueryTarget[]);

  const invalidate = (queryKey: any) =>
    qc.invalidateQueries({ queryKey, exact: false }).catch(() => {});

  const tasks: Array<Promise<unknown>> = [];

  // 공통: 상태 전용 키만 무효화 (루트 키 제외 → 지식/할일 등 연쇄 무효화 방지)
  if (wants.has("all") || wants.has("state")) {
    tasks.push(invalidate(["/api/canvases", canvasId, "state"]));
    tasks.push(invalidate(["/api/canvases", canvasId, "state", "latest"]));
    tasks.push(invalidate([`/api/canvases/${canvasId}/state`]));
    tasks.push(invalidate([`/api/canvases/${canvasId}/state/latest`]));
    tasks.push(invalidate(`/api/canvases/${canvasId}/state`));
    tasks.push(invalidate(`/api/canvases/${canvasId}/state/latest`));
    // 공개 뷰(state는 주로 내부에서만 사용하지만 일관성 차원에서 포함)
    tasks.push(invalidate(["/api/public/canvas", canvasId, "state", "latest"]));
  }

  // 할일(Todos)
  if (wants.has("all") || wants.has("todos")) {
    tasks.push(invalidate(["/api/canvases", canvasId, "todos"]));
    tasks.push(invalidate([`/api/canvases/${canvasId}/todos`]));
    tasks.push(invalidate(`/api/canvases/${canvasId}/todos`));
    // 공개 뷰에서의 키
    tasks.push(invalidate(["/api/public/canvas", canvasId, "todos"]));
  }

  // 지식(Knowledge)
  if (wants.has("all") || wants.has("knowledge")) {
    tasks.push(invalidate(["/api/canvases", canvasId, "knowledge"]));
    tasks.push(invalidate([`/api/canvases/${canvasId}/knowledge`]));
    tasks.push(invalidate(`/api/canvases/${canvasId}/knowledge`));
    // 공개 뷰에서의 키
    tasks.push(invalidate(["/api/public/canvas", canvasId, "knowledge"]));
  }

  // 공유 멤버(권한)
  if (wants.has("all") || wants.has("shares")) {
    tasks.push(invalidate(["/api/canvases", canvasId, "shares"]));
    tasks.push(invalidate(["/api/user/canvases"]));
  }

  // 메모(현재 fetch 직접 사용, 추후 확장 대비)
  if (wants.has("all") || wants.has("memos")) {
    tasks.push(invalidate(["/api/canvases", canvasId, "memos"]));
    tasks.push(invalidate([`/api/canvases/${canvasId}/memos`]));
    tasks.push(invalidate(`/api/canvases/${canvasId}/memos`));
  }

  // 워크스페이스 자산(지식 업로드 후 목록 갱신용)
  if ((wants.has("all") || wants.has("assets")) && workspaceId) {
    tasks.push(invalidate(["/api/workspaces", workspaceId, "assets"]));
  }

  await Promise.all(tasks);
}
