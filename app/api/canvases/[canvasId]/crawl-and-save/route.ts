import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { withAuthorization } from '@/lib/auth/withAuthorization';
import { crawlWebsite } from "@/services/apify/websiteCrawler";
import { extractYouTubeTranscript, isValidYouTubeUrl } from "@/services/apify/youtubeTranscript";

/**
 * Canvas Crawl and Save API - 크롤링 후 Canvas Knowledge에 직접 저장
 * 
 * 주요 역할:
 * 1. URL 크롤링 및 YouTube 트랜스크립트 추출
 * 2. Canvas Knowledge Base에 즉시 저장
 * 3. 실시간 처리 상태 반환
 * 
 * 핵심 특징:
 * - 원스텝 크롤링 및 저장 프로세스
 * - 자동 타입 감지 (YouTube vs 웹사이트)
 * - 상세한 메타데이터 저장
 * 
 * 주의사항:
 * - Canvas 접근 권한 확인 필수
 * - 처리 시간이 오래 걸릴 수 있음
 * - 중복 콘텐츠 체크 권장
 */

// Functional services - no instantiation required

const postCrawlAndSave = async (
  request: NextRequest,
  { params }: { params: any }
) => {
  try {
    const { canvasId } = await params;
    const body = await request.json();
    const { url, title } = body;
    
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const supabase = createServiceClient();

    console.log(`🌐 Crawling ${url} and saving to canvas ${canvasId}`);
    const startTime = Date.now();

    let result;
    let sourceType;
    let extractedContent = "";
    let processedTitle = title || url;
    let metadata = {};

    // URL 타입 감지 및 처리
    if (isValidYouTubeUrl(url)) {
      console.log(`📺 Processing YouTube video: ${url}`);
      sourceType = "youtube";
      
      try {
        const transcriptResult = await extractYouTubeTranscript(url);
        
        extractedContent = `YouTube Video Transcript:\n\nTitle: ${transcriptResult.title}\nChannel: ${transcriptResult.channelName}\nDuration: ${transcriptResult.duration}\n\n${transcriptResult.transcript}`;
        processedTitle = title || transcriptResult.title;
        
        metadata = {
          originalTitle: transcriptResult.title,
          channelName: transcriptResult.channelName,
          duration: transcriptResult.duration,
          transcriptLength: transcriptResult.transcript.length,
          processingTimeMs: Date.now() - startTime,
          processedAt: new Date().toISOString(),
          service: "Apify YouTube Transcript Scraper"
        };

        result = {
          success: true,
          contentLength: transcriptResult.transcript.length
        };

        console.log(`✅ YouTube processing successful: ${transcriptResult.transcript.length} characters`);
      } catch (error) {
        console.error(`❌ YouTube processing failed:`, error);
        return NextResponse.json({
          success: false,
          error: `Failed to extract YouTube content: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
      }
    } else {
      console.log(`🌐 Processing website: ${url}`);
      sourceType = "url";
      
      try {
        const crawlResult = await crawlWebsite(url);
        
        if (!crawlResult.success) {
          throw new Error(crawlResult.error || 'Failed to crawl website');
        }

        extractedContent = `Website Content:\n\nTitle: ${crawlResult.title || processedTitle}\nURL: ${url}\n\n${crawlResult.text}`;
        processedTitle = title || crawlResult.title || url;
        
        metadata = {
          originalTitle: crawlResult.title,
          contentLength: crawlResult.text?.length || 0,
          processingTimeMs: Date.now() - startTime,
          processedAt: new Date().toISOString(),
          service: "Apify Website Content Crawler",
          hasHtml: !!crawlResult.html,
          hasMarkdown: !!crawlResult.markdown
        };

        result = {
          success: true,
          contentLength: crawlResult.text?.length || 0
        };

        console.log(`✅ Website crawling successful: ${crawlResult.text?.length || 0} characters`);
      } catch (error) {
        console.error(`❌ Website crawling failed:`, error);
        return NextResponse.json({
          success: false,
          error: `Failed to crawl website: ${error instanceof Error ? error.message : 'Unknown error'}`
        }, { status: 500 });
      }
    }

    // Canvas Knowledge에 저장
    console.log(`💾 Saving to DB with type: "${sourceType}"`);
    const { data: knowledgeEntry, error: knowledgeError } = await (supabase as any)
      .from('canvas_knowledge')
      .insert({
        canvas_id: canvasId,
        type: sourceType,  // 올바른 컬럼명 사용
        title: processedTitle,
        content: extractedContent,
        metadata: metadata,  // 올바른 컬럼명 사용
      })
      .select()
      .single();

    if (knowledgeError) {
      console.error("Error saving to canvas knowledge:", knowledgeError);
      return NextResponse.json({ 
        error: "Failed to save content to knowledge base",
        details: knowledgeError.message
      }, { status: 500 });
    }

    console.log(`✅ Saved crawled content to knowledge base: ${knowledgeEntry.id}`);
    
    return NextResponse.json({
      success: true,
      knowledgeId: knowledgeEntry.id,
      title: processedTitle,
      sourceType: sourceType,
      contentLength: extractedContent.length,
      preview: extractedContent.slice(0, 500),
      processingTimeMs: (metadata as any).processingTimeMs || Date.now() - startTime,
      url: url
    });
    
  } catch (error) {
    console.error('Crawl and save error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

export const POST = withAuthorization({ resourceType: 'canvas', minRole: 'member' }, postCrawlAndSave);
