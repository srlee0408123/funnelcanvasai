/**
 * sign-up/page.tsx - 회원가입 페이지 (Clerk)
 * 
 * 주요 역할:
 * 1. Clerk SignUp 컴포넌트 렌더링
 * 2. 프로덕션에서 하단 푸터/내부 링크 등 불필요한 정보 숨김
 * 3. 내부 경로 기반의 안전한 리다이렉트 사용
 * 
 * 핵심 특징:
 * - appearance.elements로 푸터/부가 요소 비표시
 * - 서버/클라이언트 공통: 외부 accounts.dev URL 노출 없음
 * - 라우팅은 /dashboard 등 내부 경로 사용
 * 
 * 주의사항:
 * - 라우팅 정책 변경 시 afterSignUpUrl은 layout.tsx의 ClerkProvider와 동기화 필요
 */
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <SignUp 
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-xl",
            footer: 'hidden',
            footerAction: 'hidden',
            footerActionLink: 'hidden',
          },
        }}
        signInUrl="/sign-in"
        forceRedirectUrl="/dashboard"
      />
    </div>
  );
}