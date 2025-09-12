import Link from "next/link";
import { Button } from "@/components/Ui/buttons";
import { 
  ArrowLeft,
  Check,
  X,
  Edit,
  Clock,
  Plus,
  Minus,
  Save,
  Loader2,
} from "lucide-react";
import {useMemo, useState, useCallback } from "react";
import type { Canvas, CanvasState } from "@shared/schema";
import { Crown, User, ChevronDown, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";

/**
 * ProfileBadge 컴포넌트
 * 프로필 정보와 플랜 정보를 표시하고 관리할 수 있는 드롭다운 컴포넌트
 */
export function ProfileBadge({ profile }: { profile?: { plan: 'free' | 'pro'; email?: string } | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { signOut } = useClerk();
  const { user } = useUser();
  const emailToShow = user?.primaryEmailAddress?.emailAddress
    || (user?.emailAddresses && user.emailAddresses[0]?.emailAddress)
    || profile?.email
    || "";

  if (!profile) return null;

  const handleUpgrade = () => {
    setIsOpen(false);
    router.push('/pricing');
  };

  const handleSignOut = async () => {
    setIsOpen(false);
    await signOut();
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 hover:bg-gray-100 rounded-lg px-3 py-2 transition-colors"
      >
        <div className="flex items-center space-x-1">
          <User className="h-4 w-4 text-gray-600" />
          <span className="text-sm text-gray-700 max-w-32 truncate">
            {emailToShow}
          </span>
        </div>
        <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
          profile.plan === 'pro'
            ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
            : 'bg-gray-200 text-gray-700'
        }`}>
          <Crown className={`h-3 w-3 ${profile.plan === 'pro' ? 'text-white' : 'text-gray-600'}`} />
          <span>{profile.plan === 'pro' ? 'Pro' : 'Free'}</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* 드롭다운 메뉴 */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-20">
            {/* 프로필 정보 헤더 */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="flex items-center space-x-2">
                <User className="h-5 w-5 text-gray-600" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{emailToShow}</p>
                  <p className="text-xs text-gray-500">
                    {profile.plan === 'pro' ? 'Pro 플랜' : '무료 플랜'}
                  </p>
                </div>
              </div>
            </div>

            {/* 플랜 관리 섹션 */}
            <div className="px-4 py-3 border-b border-gray-200">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">현재 플랜</span>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    profile.plan === 'pro'
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
                      : 'bg-gray-200 text-gray-700'
                  }`}>
                    <Crown className={`h-3 w-3 mr-1 ${profile.plan === 'pro' ? 'text-white' : 'text-gray-600'}`} />
                    {profile.plan === 'pro' ? 'Pro' : 'Free'}
                  </span>
                </div>

                {profile.plan === 'free' && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-3 rounded-lg space-y-2">
                    <p className="text-xs text-blue-700">
                      Pro 플랜으로 업그레이드하여 모든 기능을 이용해보세요!
                    </p>
                    <ul className="text-[11px] text-blue-800 list-disc pl-4 space-y-1">
                      <li>워크스페이스 1개, 캔버스 1개 제한</li>
                      <li>노드+메모+할일 합계 10개 제한</li>
                      <li>협업자 초대 불가</li>
                      <li>AI 질문 1일 5개</li>
                      <li>지식 업로드 캔버스당 3개</li>
                    </ul>
                    <button
                      onClick={handleUpgrade}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-xs font-medium py-2 px-3 rounded-md hover:from-blue-700 hover:to-indigo-700 transition-colors"
                    >
                      Pro로 업그레이드 (₩9,900/월)
                    </button>
                  </div>
                )}

                {profile.plan === 'pro' && (
                  <div className="bg-gradient-to-r from-yellow-50 to-orange-50 p-3 rounded-lg">
                    <p className="text-xs text-orange-700 mb-2">
                      Pro 플랜을 이용하고 계십니다. 모든 기능을 사용할 수 있습니다.
                    </p>
                    <div className="text-xs text-orange-600">
                      • 무제한 노드 생성<br />
                      • 무제한 협업자 초대<br />
                      • 무제한 AI 질문
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 메뉴 아이템들 */}
            <div className="py-1">
              <Link
                href="/pricing"
                className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900"
                onClick={() => setIsOpen(false)}
              >
                <Crown className="h-4 w-4 mr-3 text-gray-500" />
                요금제 관리
              </Link>
              <button
                onClick={handleSignOut}
                className="w-full flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <LogOut className="h-4 w-4 mr-3 text-red-500" />
                로그아웃
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * CanvasHeader - 캔버스 상단 헤더 영역 컴포넌트
 * 
 * 주요 역할:
 * 1. 캔버스 제목 표시 및 인라인 편집
 * 2. 저장/줌 컨트롤 버튼 제공
 * 3. 노드 추가(모달 오픈 트리거) 및 뷰포트 제어
 * 
 * 핵심 특징:
 * - 제목 편집 상태를 내부에서 관리하고 저장 콜백을 통해 상위에 반영
 * - Tailwind 기반의 일관된 UI와 접근성 고려
 * - 불필요한 리렌더 방지를 위한 useMemo/useCallback 최적화
 * 
 * 주의사항:
 * - 상위에서 전달하는 onUpdateTitle, onManualSave는 실패 처리/토스트를 담당해야 함
 * - setViewport는 확대/축소 시 최소/최대 범위를 상위에서 보장
 */
interface ProfileInfo {
  plan: 'free' | 'pro';
  email?: string;
  phone_number?: string;
}

export interface CanvasHeaderProps {
  canvas: Canvas;
  canvasState?: CanvasState;
  isReadOnly?: boolean;
  viewport: { x: number; y: number; zoom: number };
  setViewport: (v: { x: number; y: number; zoom: number }) => void;
  onOpenCreateNode: () => void;
  onManualSave: () => void;
  onUpdateTitle: (newTitle: string) => Promise<void> | void;
  onResetOrCenterViewport: () => void;
  lastSavedAt?: number | null;
  isSaving?: boolean;
  profile?: ProfileInfo | null;
}

export function CanvasHeader({
  canvas,
  canvasState,
  isReadOnly = false,
  viewport,
  setViewport,
  onOpenCreateNode,
  onManualSave,
  onUpdateTitle,
  onResetOrCenterViewport,
  lastSavedAt,
  isSaving = false,
  profile,
}: CanvasHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [isSavingTitle, setIsSavingTitle] = useState(false);

  const lastSavedText = useMemo(() => {
    if (lastSavedAt) return new Date(lastSavedAt).toLocaleString();
    return canvasState ? new Date(canvasState.createdAt!).toLocaleString() : "저장된 상태 없음";
  }, [lastSavedAt, canvasState]);

  const handleTitleEdit = useCallback(() => {
    if (isReadOnly) return;
    setEditedTitle(canvas.title);
    setIsEditingTitle(true);
  }, [canvas.title, isReadOnly]);

  const handleTitleSave = useCallback(async () => {
    if (!editedTitle.trim() || editedTitle === canvas.title) {
      setIsEditingTitle(false);
      return;
    }
    
    setIsSavingTitle(true);
    try {
      await onUpdateTitle(editedTitle.trim());
      setIsEditingTitle(false);
    } catch (error) {
      // 에러 발생 시 편집 상태 유지 (사용자가 다시 시도할 수 있도록)
      console.error('Title save failed:', error);
    } finally {
      setIsSavingTitle(false);
    }
  }, [editedTitle, canvas.title, onUpdateTitle]);

  const handleTitleCancel = useCallback(() => {
    setEditedTitle("");
    setIsEditingTitle(false);
  }, []);

  const handleTitleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleTitleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleTitleCancel();
    }
  }, [handleTitleSave, handleTitleCancel]);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between group">
        <div className="flex items-center space-x-4">
          <Link
            href={`/workspace/${canvas.workspaceId}`}
            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="워크스페이스의 캔버스 목록으로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          {isEditingTitle ? (
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                onKeyDown={handleTitleKeyDown}
                onBlur={handleTitleSave}
                className="font-semibold text-gray-900 bg-transparent border-b-2 border-blue-500 focus:outline-none text-lg px-1"
                autoFocus
                disabled={isSavingTitle}
              />
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleTitleSave}
                  disabled={isSavingTitle}
                  className="p-1 text-green-600 hover:bg-green-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title={isSavingTitle ? "저장 중..." : "저장"}
                >
                  {isSavingTitle ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={handleTitleCancel}
                  disabled={isSavingTitle}
                  className="p-1 text-red-600 hover:bg-red-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                  title="취소"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <h2 
              className={`font-semibold text-gray-900 flex items-center space-x-2 ${!isReadOnly ? 'cursor-pointer hover:text-blue-600 transition-colors' : ''}`}
              onClick={!isReadOnly ? handleTitleEdit : undefined}
              title={!isReadOnly ? "클릭해서 이름 변경" : ""}
            >
              <span>{canvas.title}</span>
              {isSavingTitle ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              ) : (
                !isReadOnly && <Edit className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </h2>
          )}
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>마지막 저장: {lastSavedText}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {!isReadOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onOpenCreateNode}
              title="노드 추가"
              className="hover:bg-blue-50 hover:text-blue-600"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          {!isReadOnly && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onManualSave}
              disabled={isSaving}
              title={isSaving ? "저장 중..." : "수동 저장"}
              className={isSaving ? "cursor-not-allowed" : ""}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
            </Button>
          )}
          <div className="w-px h-6 bg-gray-200"></div>
          <Button
            variant="outline"
            size="sm"
            onClick={onResetOrCenterViewport}
          >
            {Math.round(viewport.zoom * 100)}%
          </Button>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // 10% 단위 줌 인, 50%~200% 범위 제한
                const STEP = 0.1;
                const MIN_ZOOM = 0.5; // 최소 50%
                const MAX_ZOOM = 2.0; // 최대 200%
                const target = viewport.zoom + STEP;
                const quantized = Math.round(target * 10) / 10;
                const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, quantized));
                setViewport({ ...viewport, zoom: newZoom });
              }}
              disabled={viewport.zoom >= 2.0}
              title="줌 인 (10% 단위)"
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                // 10% 단위 줌 아웃, 50%~200% 범위 제한
                const STEP = 0.1;
                const MIN_ZOOM = 0.5; // 최소 50%
                const MAX_ZOOM = 2.0; // 최대 200%
                const target = viewport.zoom - STEP;
                const quantized = Math.round(target * 10) / 10;
                const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, quantized));
                setViewport({ ...viewport, zoom: newZoom });
              }}
              disabled={viewport.zoom <= 0.5}
              title="줌 아웃 (10% 단위)"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>
          <div className="w-px h-6 bg-gray-200"></div>
          {/* 프로필 정보 표시 */}
          <ProfileBadge profile={profile} />
        </div>
      </div>
    </div>
  );
}
