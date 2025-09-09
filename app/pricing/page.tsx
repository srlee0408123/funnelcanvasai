/**
 * Pricing - 요금제 페이지
 *
 * 주요 역할:
 * 1. Canvas AI 요금제 정보 제공
 * 2. 무료 플랜과 Pro 플랜 비교
 * 3. 회원가입 유도 및 결제 안내
 *
 * 핵심 특징:
 * - 랜딩 페이지의 pricing 섹션을 독립 페이지로 구성
 * - 반응형 디자인으로 모바일/데스크톱 최적화
 * - Clerk 인증 시스템과 연동된 회원가입/로그인
 *
 * 주의사항:
 * - 버튼 동작:
 *   - 무료 플랜: 회원가입 링크
 *   - Pro 플랜: 업그레이드(전화번호 등록 → 결제 페이지)
 *   - Pro 활성 사용자: "현재 Pro 이용중" + "다운그레이드 안내" 모달
 * - 브랜드 컬러는 navy-900 기준으로 통일
 * - 성능 최적화를 위해 필요한 컴포넌트만 로드
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/Ui/buttons";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { useToast } from "@/hooks/use-toast";
import { createToastMessage } from "@/lib/messages";
import { ProfileBadge } from "@/components/Canvas/CanvasHeader";
import { useProfile } from "@/hooks/useAuth";
import { ArrowLeft } from "lucide-react";

// 전화번호 노멀라이즈: 숫자만 남기고 010으로 시작하는 11자리 형태 유지
function normalizeKRPhone(input: string): string {
  const digits = (input || "").replace(/\D/g, "");
  if (digits.startsWith("010")) {
    return digits.slice(0, 11);
  }
  if (digits.length === 8) {
    return `010${digits}`;
  }
  return digits;
}

function isValidKRPhone(digitsOnly: string): boolean {
  return /^010\d{8}$/.test(digitsOnly);
}

export default function Pricing() {
  const { isSignedIn, user } = useUser();
  const router = useRouter();
  const { toast } = useToast();
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasShownSuccessRef = useRef(false);
  const [isProActive, setIsProActive] = useState<boolean | null>(null);
  const [showDowngradeModal, setShowDowngradeModal] = useState(false);

  // 프로필 정보 가져오기
  const { profile } = useProfile();

  // 로그인 상태일 때 기존 전화번호/플랜 정보 불러오기
  useEffect(() => {
    (async () => {
      try {
        if (!isSignedIn) return;
        const res = await fetch("/api/profile/phone", { method: "GET" });
        if (!res.ok) return;
        const data = await res.json();
        if (data?.phoneNumber) {
          setPhone(normalizeKRPhone(String(data.phoneNumber)));
        }
      } catch (_) {}
    })();
  }, [isSignedIn]);

  const onClickPro = () => {
    setError(null);
    const normalized = normalizeKRPhone(phone);
    // 이미 로그인 & 전화번호 등록되어 있으면 바로 결제 탭으로 이동 (모달 생략)
    if (isSignedIn && isValidKRPhone(normalizeKRPhone(normalized))) {
      if (typeof window !== "undefined") {
        try { localStorage.setItem('upgrade_in_progress', '1'); } catch (_) {}
        window.open("https://www.latpeed.com/memberships/65c4b3594efe74041adac49c", "_blank", "noopener,noreferrer");
      }
      return;
    }
    setShowPhoneModal(true);
  };

  const savePhoneAndProceed = async () => {
    try {
      setSaving(true);
      setError(null);
      const normalized = normalizeKRPhone(phone);
      if (!isValidKRPhone(normalized)) {
        setError("전화번호는 010으로 시작하는 11자리여야 합니다.");
        setSaving(false);
        return;
      }

      if (!isSignedIn) {
        if (typeof window !== "undefined") {
          localStorage.setItem("pending_phone_number", normalized);
        }
        window.location.href = "/sign-up";
        return;
      }

      const resp = await fetch("/api/profile/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: normalized }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => null);
        throw new Error(j?.error || "전화번호 저장 실패");
      }

      setShowPhoneModal(false);
      // 저장 후 Latpeed 결제 페이지를 새 탭으로 열기
      if (typeof window !== "undefined") {
        try { localStorage.setItem('upgrade_in_progress', '1'); } catch (_) {}
        window.open("https://www.latpeed.com/memberships/65c4b3594efe74041adac49c", "_blank", "noopener,noreferrer");
      }
    } catch (e: any) {
      setError(e?.message || "전화번호 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // 가시성 변경 또는 페이지 복귀 시 결제 성공 여부 폴링 후 토스트 노출
  useEffect(() => {
    let intervalId: any;
    let visibilityHandler: any;

    const checkPayment = async () => {
      try {
        if (hasShownSuccessRef.current) return;
        const res = await fetch("/api/payments/status", { method: "GET", credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        setIsProActive(Boolean(data?.success));
        const shouldShowToast = Boolean(
          data?.success &&
          !hasShownSuccessRef.current &&
          // 업그레이드 플로우를 통해 돌아온 경우에만 토스트 노출
          (typeof window !== 'undefined' && localStorage.getItem('upgrade_in_progress'))
        );
        if (shouldShowToast) {
          hasShownSuccessRef.current = true;
          const msg = createToastMessage.custom(
            "결제가 완료되었습니다",
            "전화번호 매칭을 확인했습니다. Pro 기능이 활성화되었습니다.",
            "default"
          );
          toast(msg);
          // 성공 시 로컬 플래그 제거 및 추가 폴링 중단
          if (typeof window !== 'undefined') {
            try { localStorage.removeItem('upgrade_in_progress'); } catch (_) {}
          }
          if (intervalId) clearInterval(intervalId);
          if (typeof document !== "undefined") {
            document.removeEventListener("visibilitychange", visibilityHandler);
          }
        }
      } catch (_) {}
    };

    // 페이지에 복귀했을 때 우선 확인
    visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        checkPayment();
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", visibilityHandler);
    }

    // 5초 간격 폴링 (최대 5분)
    intervalId = setInterval(checkPayment, 5000);
    const timeoutId = setTimeout(() => clearInterval(intervalId), 5 * 60 * 1000);

    // 초기 로드 시 한 번 체크 (로그인 상태에서만 의미 있음)
    checkPayment();

    return () => {
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", visibilityHandler);
      }
    };
  }, [isSignedIn, toast]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="hover:bg-gray-100"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                대시보드로 돌아가기
              </Button>
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Canvas AI</h1>
                <p className="text-sm text-gray-600">요금제</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              {isSignedIn && <ProfileBadge profile={profile} />}
            </div>
          </div>
        </div>
      </div>

      {/* Pricing Section */}
      <div className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 sm:mb-16">
            <h1 className="text-2xl sm:text-3xl font-bold text-navy-900 mb-4 sm:mb-6 px-4">간단한 요금제</h1>
            <p className="text-base sm:text-lg text-slate-600 px-4">무료로 시작해서 필요할 때 업그레이드하세요</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="bg-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-lg border-2 border-slate-100">
              <div className="text-center mb-6 sm:mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-navy-900 mb-2">무료 플랜</h3>
                <div className="text-3xl sm:text-4xl font-bold text-slate-600 mb-3 sm:mb-4">₩0</div>
                <p className="text-slate-500 text-sm sm:text-base">영원히 무료</p>
              </div>
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>노드 10개</strong> (메모, 할일 포함)</span>
                </li>
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>협업자 추가 기능</strong> 제한</span>
                </li>
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>AI 질문 5개</strong> 제한</span>
                </li>
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-green-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>지식 자료 업로드 3개</strong> 제한</span>
                </li>
              </ul>
              <Link href="/sign-up">
                {isProActive ? (
                  <Button
                    disabled
                    className="w-full bg-slate-100 text-slate-400 cursor-not-allowed font-semibold text-sm sm:text-base py-2 sm:py-3"
                  >
                    현재 Pro 이용중
                  </Button>
                ) : (
                  <Button
                    className="w-full bg-slate-100 text-navy-900 hover:bg-slate-200 font-semibold text-sm sm:text-base py-2 sm:py-3"
                  >
                    무료로 시작하기
                  </Button>
                )}
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="bg-navy-900 text-white rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-2xl sm:transform sm:scale-105">
              <div className="text-center mb-6 sm:mb-8">
                <div className="inline-block bg-blue-500 text-white px-3 sm:px-4 py-1 rounded-full text-xs sm:text-sm font-bold mb-3 sm:mb-4">
                  인기
                </div>
                <h3 className="text-xl sm:text-2xl font-bold mb-2">Pro 플랜</h3>
                <div className="text-3xl sm:text-4xl font-bold mb-3 sm:mb-4">₩9,900</div>
                <p className="opacity-90 text-sm sm:text-base">월 구독</p>
              </div>
              <ul className="space-y-3 sm:space-y-4 mb-6 sm:mb-8">
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>무제한 노드</strong> 생성</span>
                </li>
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>무제한 협업자</strong> 초대</span>
                </li>
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>무제한 AI 질문</strong></span>
                </li>
                <li className="flex items-center">
                  <div className="w-5 h-5 sm:w-6 sm:h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                    <svg className="w-3 h-3 sm:w-4 sm:h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <span className="text-sm sm:text-base"><strong>지식 자료 무제한</strong> 업로드</span>
                </li>
              </ul>
              {isProActive ? (
                <div>
                  <Button
                    disabled
                    className="w-full bg-slate-100 text-slate-400 hover:bg-slate-100 font-semibold shadow-lg text-sm sm:text-base py-2 sm:py-3"
                  >
                    현재 Pro 이용중
                  </Button>
                  <div className="mt-2" />
                  <Button
                    onClick={() => setShowDowngradeModal(true)}
                    className="w-full bg-white text-navy-900 hover:bg-slate-50 font-semibold shadow-lg text-sm sm:text-base py-2 sm:py-3"
                  >
                    다운그레이드 안내
                  </Button>
                  <p className="text-xs sm:text-sm opacity-80 mt-2">
                    해지 시 현재 결제 기간 종료일까지 Pro 유지, 이후 자동으로 Free로 전환됩니다.
                  </p>
                </div>
              ) : (
                <Button
                  onClick={onClickPro}
                  className="w-full bg-white text-navy-900 hover:bg-slate-50 font-semibold shadow-lg text-sm sm:text-base py-2 sm:py-3"
                >
                  Pro로 업그레이드
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      {showPhoneModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-navy-900 mb-2">전화번호 등록</h2>
            <p className="text-sm text-slate-600 mb-4">
              멤버십 결제 확인을 위해 전화번호를 등록해주세요. 형식: 01012341234
            </p>
            <div className="space-y-2">
              <input
                type="tel"
                inputMode="numeric"
                pattern="010\\d{8}"
                maxLength={13}
                value={phone}
                onChange={(e) => setPhone(normalizeKRPhone(e.target.value))}
                placeholder="01012341234"
                className="w-full border rounded-lg px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
              {!isValidKRPhone(normalizeKRPhone(phone)) && (
                <p className="text-xs text-red-500">010으로 시작하는 숫자 11자리를 입력하세요.</p>
              )}
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
            <div className="flex gap-2 mt-4">
              <Button
                onClick={() => setShowPhoneModal(false)}
                className="flex-1 bg-slate-100 text-slate-800 hover:bg-slate-200"
              >
                취소
              </Button>
              <Button
                onClick={savePhoneAndProceed}
                disabled={saving}
                className="flex-1 bg-navy-900 text-white hover:bg-navy-800"
              >
                {saving ? "저장 중..." : "저장하고 계속"}
              </Button>
            </div>
          </div>
        </div>
      )}
      {showDowngradeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl">
            <h2 className="text-lg font-bold text-navy-900 mb-2">다운그레이드 안내</h2>
            <div className="text-sm text-slate-700 space-y-3 mb-4">
              <p>
                Pro 플랜 해지는 결제 제공사에서 처리됩니다. 해지 후 현재 결제 주기 종료일까지 Pro 혜택이 유지되며, 종료 후 자동으로 무료 플랜으로 전환됩니다.
              </p>
              <p>
                이미 해지를 신청하셨다면, 결제 주기 종료 시점에 자동으로 무료 플랜으로 변경됩니다.
              </p>
              <p className="text-red-500 font-bold">
                단 3일 이내 결제시 환불 되며, 무료 플랜으로 바로 변경 됩니다.
              </p>
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="font-semibold text-slate-800 mb-2">Pro 플랜 해지 방법:</p>
                <p className="text-slate-700">
                  카카오톡으로 래피드 검색 → 멤버십 상품 검색 → &quot;구독 내역 확인하기&quot; 클릭 → 맨 상단의 멤버십 관리 토글 클릭 → &quot;해지&quot; 선택
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <Button
                onClick={() => setShowDowngradeModal(false)}
                className="flex-1 bg-navy-900 text-white hover:bg-navy-800"
              >
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
