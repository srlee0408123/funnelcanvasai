# Canvas AI - Next.js 15 + Supabase

AI 기반 마케팅 퍼널 빌더 플랫폼

## 🚀 기술 스택

- **프레임워크**: Next.js 15 (App Router)
- **데이터베이스**: Supabase (PostgreSQL)
- **인증**: Supabase Auth
- **스토리지**: Supabase Storage
- **스타일링**: Tailwind CSS + shadcn/ui
- **AI**: OpenAI API
- **상태 관리**: React Query (TanStack Query)
- **언어**: TypeScript

## 📋 필수 요구사항

- Node.js 18+ 
- npm 또는 yarn
- Supabase 계정
- OpenAI API 키

## 🛠️ 설치 및 설정

### 1. 프로젝트 클론 및 의존성 설치

```bash
git clone https://github.com/your-username/funnelcanvasai.git
cd funnelcanvasai
npm install
```

### 2. Supabase 프로젝트 설정

1. [Supabase](https://supabase.com)에서 새 프로젝트 생성
2. 프로젝트 설정에서 다음 정보 확인:
   - Project URL
   - Anon Key
   - Service Role Key
   - Project ID

### 3. 환경 변수 설정

`.env.example`을 `.env.local`로 복사하고 값 입력:

```bash
cp .env.example .env.local
```

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_PROJECT_ID=your-project-id

# OpenAI
OPENAI_API_KEY=your-openai-api-key

# Optional APIs
APIFY_TOKEN=your-apify-token
YOUTUBE_API_KEY=your-youtube-api-key
SERPAPI_API_KEY=your-serpapi-key
```

### 4. 데이터베이스 마이그레이션

Supabase 대시보드에서 SQL 에디터를 열고 다음 파일들을 순서대로 실행:

1. `supabase/migrations/00001_initial_schema.sql`
2. `supabase/migrations/00002_storage_buckets.sql`

### 5. Google OAuth 설정

1. Supabase 대시보드 > Authentication > Providers
2. Google 활성화
3. Google Cloud Console에서 OAuth 2.0 클라이언트 ID 생성
4. 리다이렉트 URI 추가: `https://your-project.supabase.co/auth/v1/callback`

### 6. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## 📁 프로젝트 구조

```
├── app/                    # Next.js App Router
│   ├── api/               # API 라우트
│   ├── auth/              # 인증 관련 라우트
│   ├── dashboard/         # 대시보드 페이지
│   ├── canvas/            # 캔버스 에디터
│   ├── share/             # 공유 페이지
│   └── admin/             # 관리자 페이지
├── components/            # React 컴포넌트
│   ├── ui/               # shadcn/ui 컴포넌트
│   ├── Canvas/           # 캔버스 관련 컴포넌트
│   └── Modals/           # 모달 컴포넌트
├── lib/                   # 유틸리티 함수
│   └── supabase/         # Supabase 클라이언트
├── hooks/                 # React 커스텀 훅
├── services/              # 외부 서비스 통합
└── supabase/             # Supabase 마이그레이션

```

## 🎯 주요 기능

### 사용자 기능
- ✅ Google 소셜 로그인
- ✅ 드래그 앤 드롭 퍼널 빌더
- ✅ AI 기반 퍼널 최적화 제안
- ✅ PDF/YouTube/웹사이트 지식 업로드
- ✅ 실시간 AI 채팅 지원
- ✅ 캔버스 공유 및 협업
- ✅ 템플릿 라이브러리

### 관리자 기능
- ✅ 사용자 관리
- ✅ 템플릿 관리
- ✅ 통계 대시보드

## 🚀 배포

### Vercel 배포 (권장)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/funnelcanvasai)

1. 위 버튼 클릭 또는 Vercel 대시보드에서 프로젝트 임포트
2. 환경 변수 설정
3. 배포 완료

### 수동 배포

```bash
# 빌드
npm run build

# 프로덕션 실행
npm run start
```

## 📝 개발 가이드

### 데이터베이스 타입 생성

```bash
npm run db:generate
```

### 새로운 API 엔드포인트 추가

```typescript
// app/api/your-endpoint/route.ts
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  // API 로직
}
```

### Supabase Storage 사용

```typescript
const { data, error } = await supabase.storage
  .from('canvas-assets')
  .upload(`${userId}/${fileName}`, file)
```

## 🔧 트러블슈팅

### 일반적인 문제 해결

1. **인증 오류**: Supabase URL과 Anon Key 확인
2. **데이터베이스 연결 실패**: RLS 정책 확인
3. **스토리지 업로드 실패**: 버킷 정책 확인

## 📚 참고 자료

- [Next.js 문서](https://nextjs.org/docs)
- [Supabase 문서](https://supabase.com/docs)
- [shadcn/ui 문서](https://ui.shadcn.com)

## 📄 라이선스

MIT License

## 🤝 기여하기

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request