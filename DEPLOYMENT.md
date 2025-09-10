# Next.js 배포 가이드

## 배포 옵션

### 1. Vercel (권장)

가장 간단하고 Next.js에 최적화된 배포 방법입니다.

#### 배포 단계:

1. **GitHub 저장소 연결**
   ```bash
   git init
   git add .
   git commit -m "Initial Next.js migration"
   git remote add origin https://github.com/your-username/funnelcanvasai.git
   git push -u origin main
   ```

2. **Vercel 프로젝트 생성**
   - [Vercel](https://vercel.com) 로그인
   - "New Project" 클릭
   - GitHub 저장소 선택
   - 프레임워크 자동 감지 (Next.js)

3. **환경 변수 설정**
   Vercel 대시보드에서 다음 환경 변수 추가:
   ```
   DATABASE_URL=postgresql://...
   NEXTAUTH_URL=https://your-domain.vercel.app
   NEXTAUTH_SECRET=your-secret-key
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   OPENAI_API_KEY=your-openai-key
   ```

4. **배포**
   - "Deploy" 클릭
   - 자동 빌드 및 배포 진행

### 2. Railway

데이터베이스와 앱을 한 곳에서 관리할 수 있습니다.

```bash
# Railway CLI 설치
npm install -g @railway/cli

# 로그인
railway login

# 프로젝트 초기화
railway init

# 환경 변수 설정
railway variables set DATABASE_URL="..."
railway variables set NEXTAUTH_SECRET="..."

# 배포
railway up
```

### 3. Docker + Cloud Run (Google Cloud)

#### Dockerfile 생성:

```dockerfile
# Base image
FROM node:20-alpine AS base

# Dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

# Builder
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED 1

RUN npm run build

# Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

#### 배포 명령:

```bash
# Docker 이미지 빌드
docker build -t funnelcanvasai .

# Google Cloud Run 배포
gcloud run deploy funnelcanvasai \
  --image gcr.io/your-project/funnelcanvasai \
  --platform managed \
  --region asia-northeast3 \
  --allow-unauthenticated
```

### 4. Netlify

```bash
# Netlify CLI 설치
npm install -g netlify-cli

# 빌드
npm run build

# 배포
netlify deploy --prod
```

## 프로덕션 체크리스트

### 배포 전 확인사항:

- [ ] 환경 변수 설정 완료
  - [ ] DATABASE_URL
  - [ ] NEXTAUTH_URL (프로덕션 URL)
  - [ ] NEXTAUTH_SECRET
  - [ ] Google OAuth 크레덴셜
  - [ ] API 키들

- [ ] 데이터베이스 마이그레이션
  ```bash
  npm run db:push
  ```

- [ ] 빌드 테스트
  ```bash
  npm run build
  npm run start
  ```

- [ ] Google OAuth 리다이렉트 URL 업데이트
  - Google Cloud Console에서 프로덕션 URL 추가
  - `https://your-domain.com/api/auth/callback/google`

- [ ] CORS 설정 확인
  - next.config.mjs의 headers 설정 검토

## 모니터링 및 로깅

### 1. Vercel Analytics

```bash
npm install @vercel/analytics
```

```tsx
// app/layout.tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### 2. Sentry 에러 트래킹

```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

### 3. 상태 모니터링

- Uptime Robot: https://uptimerobot.com
- Better Uptime: https://betteruptime.com

### 4. Slack 알림 (Supabase Edge Function)

결제 웹훅 이벤트 및 서버 오류를 Slack으로 전송합니다. 다음을 설정하세요.

1) Supabase Functions 환경변수 설정 (Project → Functions → Config):

- `SLACK_WEBHOOK_URL`: Incoming Webhook URL (옵션)
- `SLACK_BOT_TOKEN`: `xoxb-...` Bot 토큰 (옵션)
- `SLACK_DEFAULT_CHANNEL`: Bot 토큰 사용 시 필수. 예: `#alerts`

위 중 하나의 방식만 선택: Webhook 또는 Bot 토큰(+기본 채널).

2) 함수 배포:

```bash
supabase functions deploy slack-notify --project-ref $SUPABASE_PROJECT_ID
```

3) Next.js 서버 환경변수 (API 라우트에서 함수 호출):

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

서버는 `POST ${NEXT_PUBLIC_SUPABASE_URL}/functions/v1/slack-notify` 로 호출하며, `Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}` 를 보냅니다.

4) 확인 사항:

- 멤버십 결제 성공/취소, 일반 결제 저장 시 Slack 메시지 전송
- 오류 발생 시 level=error로 Slack 전송
- 메시지가 오지 않으면 Supabase → Logs → Functions에서 함수 로그 확인

## 배포 자동화

### GitHub Actions

`.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm test
        
      - name: Build
        run: npm run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          NEXTAUTH_SECRET: ${{ secrets.NEXTAUTH_SECRET }}
          
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

## 롤백 전략

### Vercel에서 롤백:

1. Vercel 대시보드 접속
2. Deployments 탭 이동
3. 이전 배포 선택
4. "Promote to Production" 클릭

### Git을 통한 롤백:

```bash
# 이전 커밋으로 롤백
git revert HEAD
git push origin main

# 특정 커밋으로 롤백
git revert <commit-hash>
git push origin main
```

## 트러블슈팅

### 일반적인 문제:

1. **빌드 실패**
   - Node 버전 확인 (18+ 필요)
   - 환경 변수 확인
   - 타입 에러 확인: `npm run check`

2. **데이터베이스 연결 실패**
   - DATABASE_URL 형식 확인
   - SSL 설정: `?sslmode=require` 추가
   - IP 화이트리스트 확인

3. **인증 문제**
   - NEXTAUTH_URL이 실제 도메인과 일치하는지 확인
   - Google OAuth 콜백 URL 확인
   - NEXTAUTH_SECRET 설정 확인

4. **성능 문제**
   - Next.js 캐싱 활용
   - 이미지 최적화
   - 코드 스플리팅

## 지원 및 문의

- GitHub Issues: https://github.com/your-repo/issues
- 문서: 이 README.md 파일 참조
- 커뮤니티: Discord/Slack 채널