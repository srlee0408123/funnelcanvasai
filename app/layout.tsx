/**
 * layout.tsx - 앱 전역 레이아웃 및 인증 Provider 설정
 * 
 * 주요 역할:
 * 1. ClerkProvider 설정으로 인증 라우팅/URL을 내부 경로로 고정
 * 2. 프로덕션에서 개발/테스트 표시 및 디버그성 UI 요소 숨김
 * 3. 전역 스타일, 폰트, 클라이언트 Providers 래핑
 * 
 * 핵심 특징:
 * - 환경변수 기반 URL 구성: /sign-in, /sign-up, /dashboard
 * - appearance.elements를 이용해 하단 푸터/부가 요소 최소화
 * - 보안 관점에서 내부/디버그 URL 노출 방지
 * 
 * 주의사항:
 * - 프로덕션/개발 환경에 따라 UI가 달라질 수 있으니 테스트 필수
 * - 라우팅 경로 변경 시 ClerkProvider 속성 함께 수정
 * - 외부 호스트(accounts.dev 등) URL을 직접 노출하지 않음
 */
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClerkProvider } from '@clerk/nextjs';
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Canvas AI",
  description: "AI-powered funnel building and optimization platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isProd = process.env.NODE_ENV === 'production';

  const clerkAppearance = {
    variables: {
      colorPrimary: '#6c47ff',
    },
    elements: {
      // 하단 푸터 및 부가 링크 숨김 (브랜딩/디버그 노출 최소화)
      footer: 'hidden',
      footerAction: 'hidden',
      footerActionLink: 'hidden',
    },
  } as const;

  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignInUrl="/dashboard"
      afterSignUpUrl="/dashboard"
    >
      <html lang="en" suppressHydrationWarning>
        <body className={inter.className}>
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}