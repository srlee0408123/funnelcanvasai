// @ts-nocheck
/**
 * slack-notify - Supabase Edge Function to send messages to Slack
 *
 * 주요 역할:
 * 1. Next.js 서버에서 전달한 알림 payload를 수신
 * 2. Slack Incoming Webhook 또는 Bot Token(chat.postMessage)로 메시지 전송
 * 3. CORS 대응 및 에러 시 의미 있는 응답 반환
 *
 * 핵심 특징:
 * - 환경 변수 기반 듀얼 모드 지원: SLACK_BOT_TOKEN(+SLACK_DEFAULT_CHANNEL) 또는 SLACK_WEBHOOK_URL
 * - 자유로운 payload(text, blocks, attachments, thread_ts 등) 포워딩
 * - level/title/context를 받아 단일 텍스트 메시지로도 깔끔히 포맷팅
 *
 * 주의사항:
 * - Bot Token 모드 사용 시 SLACK_DEFAULT_CHANNEL이 기본 채널로 사용됩니다.
 * - Webhook 모드는 채널 오버라이드가 제한될 수 있습니다.
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type SlackLevel = "info" | "warn" | "error";

interface SlackNotifyRequest {
  text?: string;
  title?: string;
  level?: SlackLevel;
  context?: Record<string, unknown> | unknown;
  blocks?: unknown;
  attachments?: unknown;
  channel?: string;
  username?: string;
  icon_emoji?: string;
  thread_ts?: string;
}

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders } });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const body = (await safeJson(req)) as SlackNotifyRequest | null;
    if (!body || (typeof body !== "object")) {
      return json({ error: "Invalid body" }, 400);
    }

    const { text, blocks, attachments, channel, username, icon_emoji, thread_ts, level, title, context } = body;

    if (!text && !blocks && !attachments && !title && !context) {
      return json({ error: "At least one of text/blocks/attachments/title/context is required" }, 400);
    }

    // Resolve runtime config
    const botToken = Deno.env.get("SLACK_BOT_TOKEN");
    const defaultChannel = Deno.env.get("SLACK_DEFAULT_CHANNEL");
    const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");

    // Build a friendly text fallback if only title/context/level provided
    const textFallback = buildText({ text, title, level, context });

    if (botToken) {
      if (!channel && !defaultChannel) {
        return json({ error: "Missing channel. Provide channel in body or set SLACK_DEFAULT_CHANNEL." }, 400);
      }
      const targetChannel = channel || defaultChannel!;
      const payload: Record<string, unknown> = {
        channel: targetChannel,
        text: textFallback,
        blocks: blocks,
        attachments: attachments,
        thread_ts,
        username,
        icon_emoji,
      };

      const resp = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "authorization": `Bearer ${botToken}`,
        },
        body: JSON.stringify(payload),
      });
      const j = await resp.json();
      if (!resp.ok || (j && j.ok === false)) {
        return json({ error: "Slack API error", details: j }, 500);
      }
      return json({ ok: true, mode: "bot" });
    }

    if (webhookUrl) {
      const payload: Record<string, unknown> = {
        text: textFallback,
        blocks,
        attachments,
        username,
        icon_emoji,
      };
      const resp = await fetch(webhookUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const errText = await safeText(resp);
        return json({ error: "Slack webhook error", details: errText || `${resp.status}` }, 500);
      }
      return json({ ok: true, mode: "webhook" });
    }

    return json({ error: "Missing Slack configuration. Set SLACK_BOT_TOKEN(+SLACK_DEFAULT_CHANNEL) or SLACK_WEBHOOK_URL." }, 500);
  } catch (err) {
    return json({ error: "Internal error", details: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders },
  });
}

async function safeJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

function buildText(input: { text?: string; title?: string; level?: SlackLevel; context?: unknown }): string {
  const { text, title, level, context } = input;
  if (text && (!title && !level && !context)) return text;
  const parts: string[] = [];
  if (level) parts.push(levelToEmoji(level));
  if (title) parts.push(`*${title}*`);
  if (text) parts.push(text);
  if (context && typeof context === "object") {
    try {
      parts.push("```" + JSON.stringify(context, null, 2).slice(0, 3800) + "```");
    } catch {
      // ignore
    }
  }
  return parts.join(" \n");
}

function levelToEmoji(level: SlackLevel): string {
  switch (level) {
    case "error":
      return ":rotating_light:";
    case "warn":
      return ":warning:";
    default:
      return ":information_source:";
  }
}





