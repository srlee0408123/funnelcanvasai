import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createServiceClient } from "@/lib/supabase/service";
import { extractYouTubeTranscript } from "@/services/apify/youtubeTranscript";
import { crawlWebsite } from "@/services/apify/websiteCrawler";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;
    const body = await request.json();
    const { type, title, url, canvasId, metaJson, testMode = false } = body;

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

    // 워크스페이스 멤버십 확인
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ 
        error: "Access denied to workspace" 
      }, { status: 403 });
    }

    console.log(`🚀 Creating ${type} asset: ${title} for canvas ${canvasId}`);
    console.log(`📋 Request body:`, { type, title, url, canvasId, metaJson });

    let extractedContent = "";
    let processedTitle = title;
    let additionalMeta = { ...metaJson };

    // 타입별 콘텐츠 추출 처리
    if (type === "youtube") {
      try {
        console.log(`📺 Processing YouTube video: ${url}`);
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

        console.log(`✅ YouTube processing successful: ${transcriptResult.transcript.length} characters extracted`);
      } catch (error) {
        console.error(`❌ YouTube processing failed:`, error);
        return NextResponse.json({
          error: `Failed to extract YouTube content: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
      }
    } else if (type === "url") {
      try {
        console.log(`🌐 Processing website URL: ${url}`);
        const crawlResult = await crawlWebsite(url);
        
        if (!crawlResult.success) {
          throw new Error(crawlResult.error || 'Failed to crawl website');
        }

        extractedContent = `Website Content:\n\nTitle: ${crawlResult.title || processedTitle}\nURL: ${url}\n\n${crawlResult.text}`;
        processedTitle = crawlResult.title || title;
        
        additionalMeta = {
          ...additionalMeta,
          originalTitle: crawlResult.title,
          contentLength: crawlResult.text?.length || 0,
          processedAt: new Date().toISOString()
        };

        console.log(`✅ Website crawling successful: ${crawlResult.text?.length || 0} characters extracted`);
      } catch (error) {
        console.error(`❌ Website crawling failed:`, error);
        return NextResponse.json({
          error: `Failed to crawl website: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
      }
    }

    // Canvas Knowledge에 저장
    // 스키마: id (auto), canvas_id, type, title, content, metadata, embedding (null), created_at (auto), updated_at (auto)
    console.log(`💾 Saving to DB with type: "${type}"`);
    const { data: knowledgeEntry, error: knowledgeError } = await supabase
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

    console.log(`✅ Saved to canvas knowledge: ${knowledgeEntry.id}`);

    return NextResponse.json({
      success: true,
      knowledgeId: knowledgeEntry.id,
      title: processedTitle,
      contentLength: extractedContent.length,
      preview: extractedContent.slice(0, 500),
      type: type,
      url: url
    });

  } catch (error) {
    console.error("Unexpected error in POST /api/workspaces/[workspaceId]/assets:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ workspaceId: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get('canvasId');

    const supabase = createServiceClient();

    // 워크스페이스 멤버십 확인
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (!membership) {
      return NextResponse.json({ 
        error: "Access denied to workspace" 
      }, { status: 403 });
    }

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

    // Normalize to frontend Asset shape for compatibility
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
}
