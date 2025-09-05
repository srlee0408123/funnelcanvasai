// @ts-nocheck
/**
 * youtube-transcript-ingest - 유튜브 URL 자막 추출 후 canvas_knowledge 저장 (Supabase Edge Function)
 * 
 * 주요 역할:
 * 1. Apify streamers/youtube-scraper로 유튜브 자막 추출 (언어 any, 자동 생성 자막 우선)
 * 2. 동일 비디오 중복 저장 방지(sourceUrl 또는 기존 originalUrl 기준)
 * 3. canvas_knowledge에 title, content(자막 원문)만 본문으로 저장(메타는 metadata에 분리)
 * 
 * 핵심 특징:
 * - run-sync-get-dataset-items를 사용해 결과를 즉시 수신
 * - LangChain 친화적: content에는 자막 원문만 저장
 * - 안전한 파싱: 다양한 응답 필드 케이스를 대응
 * 
 * 주의사항:
 * - 환경변수: APIFY_API_TOKEN, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 필요
 * - RLS가 비활성화되어 있어도 권한 검증은 서비스 요건에 맞춰 별도 추가 가능
 * - 에러는 사용자 친화 메시지와 함께 코드로 구분하여 반환
 */

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface IngestRequestBody {
  canvasId: string;
  youtubeUrl: string;
  title?: string;
  chunk?: {
    enabled?: boolean;
    maxTokens?: number; // per chunk target
    overlapTokens?: number; // sliding window overlap
  };
}

interface ApifyItem {
  id?: string;
  url?: string;
  title?: string;
  channelName?: string;
  duration?: string | number;
  subtitlesText?: string;
  subtitles?: { plaintext?: string } | any;
  transcript?: string;
  [key: string]: any;
}

type JsonRecord = Record<string, unknown>;

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders } });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { "content-type": "application/json", ...corsHeaders } });
  }

  try {
    const { canvasId, youtubeUrl, title, chunk }: IngestRequestBody = await req.json();

    if (!canvasId || !youtubeUrl) {
      return json({ success: false, code: "invalid_request", error: "canvasId와 youtubeUrl이 필요합니다." }, 400);
    }

    if (!isValidUrl(youtubeUrl)) {
      return json({ success: false, code: "invalid_url", error: "유효하지 않은 유튜브 URL입니다." }, 400);
    }

    const apifyToken = Deno.env.get("APIFY_API_TOKEN");
    // Supabase Edge Functions automatically provide these environment variables
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!apifyToken) return json({ success: false, code: "config_error", error: "APIFY_API_TOKEN이 설정되지 않았습니다." }, 500);
    // SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are automatically provided by Supabase Edge Functions

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // 1) Duplicate check (by sourceUrl or legacy originalUrl)
    {
      const { data: dup1, error: dupErr1 } = await supabase
        .from("canvas_knowledge")
        .select("id")
        .eq("canvas_id", canvasId)
        .eq("type", "youtube")
        .contains("metadata", { sourceUrl: youtubeUrl } as unknown as JsonRecord)
        .limit(1);

      if (dupErr1) {
        // continue even if contains() is not supported on some deployments
        console.error("Duplicate check sourceUrl failed:", dupErr1);
      }

      if (dup1 && dup1.length > 0) {
        return json({ success: false, code: "duplicate", error: "해당 유튜브 영상은 이미 지식에 저장되어 있습니다." }, 409);
      }

      const { data: dup2, error: dupErr2 } = await supabase
        .from("canvas_knowledge")
        .select("id")
        .eq("canvas_id", canvasId)
        .eq("type", "youtube")
        .contains("metadata", { originalUrl: youtubeUrl } as unknown as JsonRecord)
        .limit(1);

      if (dupErr2) {
        console.error("Duplicate check originalUrl failed:", dupErr2);
      }

      if (dup2 && dup2.length > 0) {
        return json({ success: false, code: "duplicate", error: "해당 유튜브 영상은 이미 지식에 저장되어 있습니다." }, 409);
      }
    }

    // 2) Call Apify with extended timeout and fallback actor
    let items: ApifyItem[] = [];
    try {
      const items1 = await callApifyStreamers(apifyToken, youtubeUrl, 90000);
      if (items1 && items1.length > 0) items = items1;
    } catch (e) {
      console.warn("Primary Apify streamers actor failed or timed out:", e);
    }

    if (!items || items.length === 0) {
      try {
        const items2 = await callApifyPintostudio(apifyToken, youtubeUrl, 90000);
        if (items2 && items2.length > 0) items = items2 as ApifyItem[];
      } catch (e2) {
        console.error("Fallback Apify pintostudio actor failed:", e2);
      }
    }

    if (!items || items.length === 0) {
      return json({ success: false, code: "no_subtitles", error: "Apify에서 자막 데이터를 가져오지 못했습니다." }, 200);
    }

    const first = items[0] || {};
    const transcript = extractTranscript(first);
    if (!transcript) {
      return json({ success: false, code: "no_subtitles", error: "이 영상은 자막을 제공하지 않습니다." }, 200);
    }

    const resolvedTitle = (first.title && String(first.title).trim()) || title || youtubeUrl;

    // 3) Insert into canvas_knowledge
    const metadata: Record<string, unknown> = {
      source: "apify",
      actor: "streamers/youtube-scraper",
      sourceUrl: youtubeUrl,
      originalUrl: youtubeUrl,
      apifyItemId: first.id || null,
      channelName: first.channelName || null,
      duration: first.duration || null,
      insertedAt: new Date().toISOString()
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("canvas_knowledge")
      .insert({
        canvas_id: canvasId,
        type: "youtube",
        title: resolvedTitle,
        content: transcript,
        metadata
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return json({ success: false, code: "db_error", error: insertErr.message || "콘텐츠 저장에 실패했습니다." }, 500);
    }

    // Optional chunking + embeddings
    if (chunk?.enabled) {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) {
        return json({ success: false, code: "openai_key_missing", error: "청킹/임베딩을 위해 OPENAI_API_KEY 설정이 필요합니다." }, 400);
      }

      const maxTokens = clampInt(chunk.maxTokens ?? 800, 200, 1500);
      const overlapTokens = clampInt(chunk.overlapTokens ?? 120, 0, Math.floor(maxTokens / 2));
      const chunks = chunkTextBySentence(transcript, maxTokens, overlapTokens);

      // generate embeddings and insert
      const embedUrl = "https://api.openai.com/v1/embeddings";
      for (let i = 0; i < chunks.length; i++) {
          const c = chunks[i];
          const seq = i + 1;
          const chunkHash = stableHash(`${inserted.id}:${seq}:${c.text.substring(0, 64)}`);
          try {
            const eresp = await fetch(embedUrl, {
              method: "POST",
              headers: {
                "content-type": "application/json",
                "authorization": `Bearer ${openaiKey}`,
              },
              body: JSON.stringify({
                model: Deno.env.get("OPENAI_EMBEDDINGS_MODEL") || "text-embedding-3-small",
                input: c.text,
              }),
            });
            const ej = await eresp.json();
            const embedding = (ej?.data?.[0]?.embedding) as number[] | undefined;

            await supabase.from("knowledge_chunks").insert({
              canvas_id: canvasId,
              knowledge_id: inserted.id,
              seq,
              text: c.text,
              embedding: embedding ?? null,
            });
          } catch (e) {
            console.error("Embedding insert failed:", e);
          }
        }
    }

    const preview = transcript.slice(0, 500);
    return json({ success: true, knowledgeId: inserted.id, title: resolvedTitle, contentLength: transcript.length, preview });
  } catch (err) {
    console.error("Unexpected error in youtube-transcript-ingest:", err);
    return json({ success: false, code: "internal_error", error: "서버 내부 오류가 발생했습니다." }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders }
  });
}

function isValidUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

async function safeJson(resp: Response): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

function extractTranscript(item: ApifyItem): string {
  // 1) Direct string fields
  const directCandidates = [item.subtitlesText, item.transcript];
  for (const c of directCandidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }

  // 2) subtitles as array of tracks
  const subs: any = (item as any)?.subtitles;
  if (Array.isArray(subs) && subs.length > 0) {
    // Prefer auto_generated (likely original audio language), fallback to longest plaintext
    const auto = subs.find((t: any) => t?.type === "auto_generated" && typeof t?.plaintext === "string" && t.plaintext.trim());
    if (auto) return String(auto.plaintext).trim();
    const withPlain = subs.filter((t: any) => typeof t?.plaintext === "string" && t.plaintext.trim());
    if (withPlain.length > 0) {
      withPlain.sort((a: any, b: any) => (b.plaintext?.length || 0) - (a.plaintext?.length || 0));
      return String(withPlain[0].plaintext).trim();
    }
  }

  // 3) streamers actor sometimes exposes subtitles as object map; keep legacy check
  if (subs && typeof subs === "object" && typeof subs.plaintext === "string" && subs.plaintext.trim()) {
    return String(subs.plaintext).trim();
  }

  // 4) last resort: some actors expose `text` (usually description). Avoid unless no subtitles at all
  const desc = (item as any)?.text;
  if (typeof desc === "string" && desc.trim().length > 200) {
    return desc.trim();
  }
  return "";
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function tokenizeRudimentary(text: string): number {
  // Simple whitespace tokenization as an approximation
  return text.split(/\s+/).filter(Boolean).length;
}

function chunkTextBySentence(text: string, maxTokens: number, overlapTokens: number): Array<{ text: string; tokens: number; start: number; end: number }> {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?\n])\s+/);
  const results: Array<{ text: string; tokens: number; start: number; end: number }> = [];
  let buffer = "";
  let startIdx = 0;
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    const tentative = buffer ? `${buffer} ${s}` : s;
    const tokens = tokenizeRudimentary(tentative);
    if (tokens > maxTokens && buffer) {
      const endIdx = startIdx + buffer.length;
      const bufTokens = tokenizeRudimentary(buffer);
      results.push({ text: buffer.trim(), tokens: bufTokens, start: startIdx, end: endIdx });
      // prepare overlap
      if (overlapTokens > 0) {
        const words = buffer.trim().split(/\s+/);
        const overlap = words.slice(Math.max(0, words.length - overlapTokens)).join(" ");
        startIdx = Math.max(0, endIdx - overlap.length);
        buffer = overlap ? `${overlap} ${s}` : s;
      } else {
        startIdx = endIdx + 1;
        buffer = s;
      }
    } else {
      if (!buffer) startIdx = text.indexOf(s, startIdx);
      buffer = tentative;
    }
  }
  if (buffer.trim()) {
    const endIdx = startIdx + buffer.length;
    const bufTokens = tokenizeRudimentary(buffer);
    results.push({ text: buffer.trim(), tokens: bufTokens, start: startIdx, end: endIdx });
  }
  return results;
}

function stableHash(input: string): string {
  // FNV-1a 32-bit hash for simplicity
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return hash.toString(16);
}


async function callApifyStreamers(token: string, youtubeUrl: string, timeoutMs = 55000): Promise<ApifyItem[]> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    const url = `https://api.apify.com/v2/acts/streamers~youtube-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const body = {
      downloadSubtitles: true,
      hasCC: false,
      hasLocation: false,
      hasSubtitles: false,
      is360: false,
      is3D: false,
      is4K: false,
      isBought: false,
      isHD: false,
      isHDR: false,
      isLive: false,
      isVR180: false,
      maxResultStreams: 0,
      maxResults: 1,
      maxResultsShorts: 0,
      preferAutoGeneratedSubtitles: true,
      saveSubsToKVS: false,
      startUrls: [
        {
          url: youtubeUrl,
          method: "GET",
        },
      ],
      subtitlesFormat: "plaintext",
    } as const;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`Apify streamers error: ${resp.status} ${await safeText(resp)}`);
    }
    const j = await safeJson(resp);
    const items: ApifyItem[] = Array.isArray(j) ? j : Array.isArray((j as any)?.items) ? (j as any).items : [];
    return items;
  } finally {
    clearTimeout(to);
  }
}

async function callApifyPintostudio(token: string, youtubeUrl: string, timeoutMs = 45000): Promise<ApifyItem[]> {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort("timeout"), timeoutMs);
  try {
    const url = `https://api.apify.com/v2/acts/pintostudio~youtube-transcript-scraper/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
    const body = {
      downloadSubtitles: true,
      hasCC: false,
      hasLocation: false,
      hasSubtitles: false,
      is360: false,
      is3D: false,
      is4K: false,
      isBought: false,
      isHD: false,
      isHDR: false,
      isLive: false,
      isVR180: false,
      maxResultStreams: 0,
      maxResults: 1,
      maxResultsShorts: 0,
      preferAutoGeneratedSubtitles: true,
      saveSubsToKVS: false,
      startUrls: [
        {
          url: youtubeUrl,
          method: "GET",
        },
      ],
      subtitlesFormat: "plaintext",
    } as const;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!resp.ok) {
      throw new Error(`Apify pintostudio error: ${resp.status} ${await safeText(resp)}`);
    }
    const j = await safeJson(resp);
    const items: ApifyItem[] = Array.isArray(j) ? j : Array.isArray((j as any)?.items) ? (j as any).items : [];
    return items;
  } finally {
    clearTimeout(to);
  }
}


