import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withAuthorization } from '@/lib/auth/withAuthorization';
import { isFreePlan, countCanvasKnowledge } from '@/lib/planLimits';
import { extractYouTubeTranscript } from "@/services/apify/youtubeTranscript";
import { buildChunks } from "@/services/textChunker";
import { OpenAIService } from "@/services/openai";
import { firecrawlService } from "@/services/firecrawl";

/**
 * Assets API - 워크스페이스 자산 관리 엔드포인트
 * 
 * 주요 역할:
 * 1. YouTube 영상, 웹사이트 URL 자산 생성
 * 2. Apify를 통한 콘텐츠 추출 및 처리
 * 3. Canvas Knowledge Base에 자동 저장
 * 
 * 핵심 특징:
 * - YouTube 트랜스크립트 자동 추출
 * - 웹사이트 콘텐츠 크롤링 및 텍스트 추출
 * - 실시간 처리 상태 업데이트
 * 
 * 주의사항:
 * - APIFY_API_TOKEN 환경변수 필수
 * - 처리 시간이 오래 걸릴 수 있음 (비동기 처리)
 * - 워크스페이스 멤버십 권한 확인 필요
 */

// Using functional services (no instantiation needed)

const postAsset = async (
  request: NextRequest,
  { params, auth }: { params: any; auth: { userId: string } }
) => {
  try {
    const { workspaceId } = await params;
    const body = await request.json();
    const { type, title, url, canvasId, metaJson, testMode = false, content } = body;

    if (!type || !title || !canvasId) {
      return NextResponse.json({ 
        error: "Missing required fields: type, title, canvasId" 
      }, { status: 400 });
    }

    if ((type === "youtube" || type === "url") && !url) {
      return NextResponse.json({ 
        error: "URL is required for YouTube and URL assets" 
      }, { status: 400 });
    }

    // 타입 검증 (DB 스키마의 CHECK 제약조건과 일치)
    const validTypes = ['pdf', 'youtube', 'url', 'text'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ 
        error: `Invalid type. Must be one of: ${validTypes.join(', ')}` 
      }, { status: 400 });
    }

    const supabase = createServiceClient();

    // 무료 플랜: 캔버스별 지식 업로드 3개 제한 (Pro는 제한 없음)
    try {
      const free = await isFreePlan(auth.userId);
      if (free) {
        const count = await countCanvasKnowledge(canvasId);
        if (count >= 3) {
          return NextResponse.json({
            error: '무료 플랜에서는 캔버스당 지식 자료를 3개까지만 업로드할 수 있습니다.',
            code: 'FREE_PLAN_LIMIT_KNOWLEDGE',
            limit: 3
          }, { status: 403 });
        }
      }
    } catch (planErr) {
      console.warn('Knowledge limit check failed:', planErr);
    }


    // knowledge.content로 저장할 원문(요구사항: markdown 우선 저장)
    let extractedContent = "";
    let processedTitle = title;
    let additionalMeta = { ...metaJson };
    let chunkTexts: string[] | null = null;
    let chunkEmbeddings: number[][] | null = null;

    // 타입별 콘텐츠 추출 처리
    if (type === "youtube") {
      try {
        const transcriptResult = await extractYouTubeTranscript(url);
        
        extractedContent = `YouTube Video Transcript:\n\nTitle: ${transcriptResult.title}\nChannel: ${transcriptResult.channelName}\nDuration: ${transcriptResult.duration}\n\n${transcriptResult.transcript}`;
        processedTitle = transcriptResult.title || title;
        
        additionalMeta = {
          ...additionalMeta,
          originalTitle: transcriptResult.title,
          channelName: transcriptResult.channelName,
          duration: transcriptResult.duration,
          transcriptLength: transcriptResult.transcript.length,
          processedAt: new Date().toISOString()
        };

      } catch (error) {
        console.error(`❌ YouTube processing failed:`, error);
        return NextResponse.json({
          error: `Failed to extract YouTube content: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
      }
    } else if (type === "url") {
      try {
        // Firecrawl로 스크랩 → { markdown, text }
        const scraped = await firecrawlService.scrapeToText(url);

        // 요구사항: knowledge.content에는 markdown 저장
        extractedContent = scraped.markdown || scraped.text;
        // 사용자가 입력한 제목을 우선 사용, 없으면 스크래핑된 제목 사용
        processedTitle = title || scraped.title || url;

        // 1) 청킹은 순수 텍스트 기준으로 수행
        chunkTexts = await buildChunks(scraped.text);

        // 2) 임베딩 일괄 생성
        const ai = new OpenAIService();
        chunkEmbeddings = await ai.generateEmbeddingsBatch(chunkTexts);

        // 메타데이터 확장
        additionalMeta = {
          ...additionalMeta,
          source: 'url',
          provider: 'firecrawl',
          originalUrl: url,
          userProvidedTitle: title, // 사용자가 입력한 제목
          scrapedTitle: scraped.title, // 웹페이지에서 추출한 제목
          contentFormat: 'markdown',
          contentLength: extractedContent.length,
          processedAt: new Date().toISOString(),
        };

      } catch (error) {
        console.error(`❌ Website scraping failed:`, error);
        return NextResponse.json({
          error: `Failed to scrape website: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
      }
    } else if (type === "text") {
      // 사용자가 직접 입력한 텍스트 업로드 처리
      const raw = typeof content === 'string' ? content : '';
      const trimmed = raw.slice(0, 10000); // 10,000자 하드 제한
      if (!trimmed) {
        return NextResponse.json({ error: "텍스트 내용이 비어 있습니다." }, { status: 400 });
      }
      extractedContent = trimmed;
      processedTitle = title || "텍스트 자료";

      // 텍스트도 청크/임베딩 생성하여 knowledge_chunks에 저장
      const textChunks = await buildChunks(extractedContent);
      const ai = new OpenAIService();
      const embeddings = await ai.generateEmbeddingsBatch(textChunks);
      chunkTexts = textChunks;
      chunkEmbeddings = embeddings;
      additionalMeta = {
        ...additionalMeta,
        source: 'text',
        contentLength: extractedContent.length,
        processedAt: new Date().toISOString(),
      };
    }

    // Canvas Knowledge에 저장
    // 스키마: id (auto), canvas_id, type, title, content, metadata, embedding (null), created_at (auto), updated_at (auto)
    const { data: knowledgeEntry, error: knowledgeError } = await (supabase as any)
      .from('canvas_knowledge')
      .insert({
        canvas_id: canvasId,        // UUID - canvases 테이블 참조
        type: type,                 // TEXT - 'pdf', 'youtube', 'url', 'text' 중 하나
        title: processedTitle,      // TEXT - 제목 (필수)
        content: extractedContent,  // TEXT - 추출된 콘텐츠 (nullable)
        metadata: additionalMeta,   // JSONB - 메타데이터 (nullable)
        // id, embedding, created_at, updated_at은 자동 생성
      })
      .select()
      .single();

    if (knowledgeError) {
      console.error("Error saving to canvas knowledge:", knowledgeError);
      return NextResponse.json({ 
        error: "Failed to save content to knowledge base",
        details: knowledgeError.message || "Unknown database error"
      }, { status: 500 });
    }
    // URL/텍스트 타입의 경우 청크 저장 수행 (PDF는 별도 라우트에서 처리)
    if ((type === 'url' || type === 'text') && chunkTexts && chunkTexts.length > 0) {
      const inserts = chunkTexts.map((text, idx) => ({
        canvas_id: canvasId,
        knowledge_id: knowledgeEntry.id,
        seq: idx + 1,
        text,
        embedding: (chunkEmbeddings && chunkEmbeddings[idx] as unknown as any) ?? null,
      }));

      const { error: chunkError } = await (supabase as any)
        .from('knowledge_chunks')
        .upsert(inserts, { onConflict: 'knowledge_id,seq' });
      if (chunkError) {
        return NextResponse.json({ 
          error: `Failed to insert chunks: ${chunkError.message}` 
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      knowledgeId: knowledgeEntry.id,
      title: processedTitle,
      contentLength: extractedContent.length,
      preview: extractedContent.slice(0, 500),
      type: type,
      url: url,
      chunkCount: chunkTexts?.length || 0,
    });

  } catch (error) {
    console.error("Unexpected error in POST /api/workspaces/[workspaceId]/assets:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
};

const getAssets = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get('canvasId');

    const supabase = createServiceClient();

    let query = supabase
      .from('canvas_knowledge')
      .select('*')
      .order('created_at', { ascending: false });

    if (canvasId) {
      query = query.eq('canvas_id', canvasId);
    }

    const { data: assets, error } = await query;

    if (error) {
      console.error("Error fetching assets:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = (assets || []).map((item: any) => ({
      id: item.id,
      workspaceId: workspaceId,
      canvasId: item.canvas_id,
      type: item.type,
      title: item.title,
      url: item.metadata?.originalUrl || null,
      fileRef: null,
      status: 'completed',
      metadata: item.metadata || {},
      createdAt: item.created_at,
      processedAt: item.updated_at,
    }));

    return NextResponse.json(normalized);

  } catch (error) {
    console.error("Unexpected error in GET /api/workspaces/[workspaceId]/assets:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
};

export const POST = withAuthorization({ resourceType: 'workspace', minRole: 'member' }, postAsset);
export const GET = withAuthorization({ resourceType: 'workspace' }, getAssets);
