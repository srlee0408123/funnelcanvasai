/**
 * slackNotify - 서버에서 Supabase Edge Function(slack-notify)을 호출하는 유틸
 *
 * 주요 역할:
 * 1. 결제 웹훅/에러 등 서버 이벤트를 Slack으로 전달
 * 2. 환경 변수(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)를 사용해 안전하게 호출
 * 3. 공통 포맷(title/level/context)으로 간편한 사용성 제공
 *
 * 핵심 특징:
 * - 서버 전용(Service Role Key 사용). 클라이언트에서 직접 사용 금지
 * - 네트워크/응답 에러에 견고한 처리. 실패 시 콘솔에만 로그
 * - 호출 타임아웃 기본 5초
 *
 * 주의사항:
 * - Supabase Edge Functions가 배포되어 있어야 합니다(`slack-notify`).
 * - SLACK_BOT_TOKEN(+SLACK_DEFAULT_CHANNEL) 또는 SLACK_WEBHOOK_URL이 Supabase 함수 측에 설정되어야 합니다.
 */

export type SlackLevel = 'info' | 'warn' | 'error';

export interface SlackNotifyPayload {
  text?: string;
  title?: string;
  level?: SlackLevel;
  context?: unknown;
  blocks?: unknown;
  attachments?: unknown;
  channel?: string;
  username?: string;
  icon_emoji?: string;
  thread_ts?: string;
}

export async function slackNotify(payload: SlackNotifyPayload, options?: { timeoutMs?: number }): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // Cannot proceed safely; log only
    console.warn('[slackNotify] Missing SUPABASE env. Skipping.', { hasUrl: !!supabaseUrl, hasKey: !!serviceKey });
    return;
  }

  const url = `${supabaseUrl}/functions/v1/slack-notify`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), Math.max(1000, options?.timeoutMs ?? 5000));
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await safeText(res);
      console.error('[slackNotify] Request failed', res.status, text);
    }
  } catch (err) {
    console.error('[slackNotify] Error calling slack-notify:', err);
  } finally {
    clearTimeout(timeout);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}







