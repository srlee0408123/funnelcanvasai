import { storage } from "./storageService";
import { OpenAIService } from "./openai";
import { buildChunks, estimateTokens } from "./textChunker";
const openaiService = new OpenAIService();
import type { Asset } from "@shared/schema";

export interface ProcessingJob {
  assetId: string;
  type: 'youtube' | 'url' | 'text';
  url?: string;
  content?: string;
}

/**
 * AssetProcessor - YouTube 및 웹 URL 자산 처리 서비스
 * 
 * 주요 역할:
 * 1. YouTube 비디오 트랜스크립트 추출 및 처리
 * 2. 웹 URL 콘텐츠 크롤링 및 텍스트 추출
 * 3. 텍스트 노트 처리
 * 
 * 핵심 특징:
 * - 청크 단위 텍스트 분할 및 임베딩 생성
 * - 비동기 처리로 대용량 콘텐츠 안정적 처리
 * 
 * 주의사항:
 * - PDF 처리는 upload-pdf 엔드포인트에서 별도 처리
 * - OpenAI 임베딩 API 사용량 제한 고려
 */
export class AssetProcessor {

  async processAsset(asset: Asset): Promise<void> {
    try {
      await storage.updateAsset(asset.id, { status: "processing" });

      let textContent = "";
      
      switch (asset.type) {
        case "pdf":
          // PDF processing is now handled by upload-pdf route
          throw new Error("PDF processing should be handled by upload-pdf endpoint");
          break;
        case "youtube":
          textContent = await this.processYouTube(asset);
          break;
        case "url":
          textContent = await this.processURL(asset);
          break;
        case "note":
          textContent = (asset.metaJson as any)?.content || "";
          break;
        default:
          throw new Error(`Unsupported asset type: ${asset.type}`);
      }

      if (!textContent) {
        throw new Error("No content extracted from asset");
      }

      // Chunk the content (shared chunker)
      const chunks = await buildChunks(textContent);
      
      // Generate embeddings and store chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await openaiService.generateEmbedding(chunk);
        
        await storage.createAssetChunk({
          assetId: asset.id,
          seq: i,
          text: chunk,
          embedding: JSON.stringify(embedding),
          tokens: estimateTokens(chunk),
        });
      }

      await storage.updateAsset(asset.id, { 
        status: "completed",
        metaJson: {
          ...(asset.metaJson as any || {}),
          chunks: chunks.length,
          processedAt: new Date().toISOString(),
        }
      });

    } catch (error) {
      console.error(`Error processing asset ${asset.id}:`, error);
      await storage.updateAsset(asset.id, { 
        status: "failed",
        metaJson: {
          ...(asset.metaJson as any || {}),
          error: (error as Error).message,
        }
      });
    }
  }


  private async processYouTube(asset: Asset): Promise<string> {
    if (!asset.url) {
      throw new Error("No YouTube URL provided");
    }

    // Extract video ID from URL
    const videoId = this.extractYouTubeId(asset.url);
    if (!videoId) {
      throw new Error("Invalid YouTube URL");
    }

    // In a real implementation, you would:
    // 1. Use YouTube API to get video details
    // 2. Extract captions/subtitles if available
    // 3. Use Apify or similar service to scrape additional data
    // 4. Combine title, description, and captions

    // For this implementation, we'll simulate YouTube processing
    return `YouTube video content: ${asset.title}. This would include captions, description, and metadata in a real implementation.`;
  }

  private async processURL(asset: Asset): Promise<string> {
    if (!asset.url) {
      throw new Error("No URL provided");
    }

    try {
      // In a real implementation, you would:
      // 1. Use Apify web scraping service
      // 2. Extract clean text content from HTML
      // 3. Handle different website structures
      // 4. Respect robots.txt and rate limits

      // For this implementation, we'll simulate URL processing
      const response = await fetch(asset.url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; FunnelBot/1.0)',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      
      // Basic HTML text extraction (in production, use a proper HTML parser)
      const textContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      if (!textContent) {
        throw new Error("No text content extracted from URL");
      }

      return textContent;
    } catch (error) {
      console.error(`Error processing URL ${asset.url}:`, error);
      throw new Error(`Failed to process URL: ${(error as Error).message}`);
    }
  }

  // chunkText/estimateTokens는 공용 유틸로 대체됨

  private extractYouTubeId(url: string): string | null {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return null;
  }
}

export const assetProcessor = new AssetProcessor();
