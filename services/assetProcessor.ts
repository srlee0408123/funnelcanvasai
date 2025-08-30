import { storage } from "../storage";
import { OpenAIService } from "./openai";
const openaiService = new OpenAIService();
import type { Asset } from "@shared/schema";

export interface ProcessingJob {
  assetId: string;
  type: 'pdf' | 'youtube' | 'url' | 'text';
  url?: string;
  content?: string;
}

export class AssetProcessor {
  async processPDFWithVision(pdfBuffer: Buffer, filename: string): Promise<{success: boolean, content?: string, error?: string}> {
    try {
      console.log(`Starting enhanced PDF Vision processing for ${filename}, size: ${pdfBuffer.length} bytes`);
      
      // Use GraphicsMagick to convert PDF to high-quality images
      const fs = await import('fs');
      const path = await import('path');
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // Create temp directory
      const tempDir = '/tmp/pdf_processing';
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      
      // Save PDF to temp file
      const tempPdfPath = path.join(tempDir, 'input.pdf');
      fs.writeFileSync(tempPdfPath, pdfBuffer);
      
      console.log('Converting PDF to images with GraphicsMagick...');
      
      // Convert PDF to high-quality PNG images using GraphicsMagick
      const outputPattern = path.join(tempDir, 'page_%03d.png');
      const gmCommand = `gm convert -density 300 -quality 100 "${tempPdfPath}" "${outputPattern}"`;
      
      try {
        await execAsync(gmCommand);
        console.log('PDF conversion completed');
      } catch (conversionError) {
        console.error('GraphicsMagick conversion failed:', conversionError);
        // Fallback to ImageMagick
        const imCommand = `convert -density 300 -quality 100 "${tempPdfPath}" "${outputPattern}"`;
        await execAsync(imCommand);
        console.log('PDF conversion completed with ImageMagick');
      }
      
      // Find generated image files
      const files = fs.readdirSync(tempDir).filter(f => f.startsWith('page_') && f.endsWith('.png')).sort();
      console.log(`Found ${files.length} page images:`, files);
      
      let fullText = "";
      
      // Process up to 5 pages to avoid API limits
      for (let i = 0; i < Math.min(files.length, 5); i++) {
        const imagePath = path.join(tempDir, files[i]);
        
        if (!fs.existsSync(imagePath)) {
          console.warn(`Page ${i + 1}: Image file not found at ${imagePath}`);
          continue;
        }
        
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');
        
        console.log(`Processing page ${i + 1} (${files[i]}) with Vision API... Size: ${imageBuffer.length} bytes`);
        
        const pageText = await openaiService.processImageWithVision(
          base64Image,
          `Please carefully examine this PDF page image and extract ALL text content you can see. This is an OCR (Optical Character Recognition) task.

Please extract:
- ALL Korean text (한글) - even if it appears garbled or uses special fonts, interpret the meaning and provide correct Korean
- ALL English text and numbers
- Headers, titles, body text, footnotes, watermarks
- Table data, chart labels, any small text
- Dates, names, addresses, and all important information
- Form fields and their values

Please maintain the original document structure and layout as much as possible.
Even if the fonts look unusual or custom, please do your best to read and transcribe the text accurately.

IMPORTANT: This is a text extraction task - please provide the actual text content you see in the image, not a description of what you cannot do.`
        );
        
        if (pageText && pageText.trim().length > 10) {
          fullText += `\n\n=== 페이지 ${i + 1} ===\n${pageText}`;
          console.log(`Page ${i + 1}: Successfully extracted ${pageText.length} characters`);
          console.log(`Sample: ${pageText.substring(0, 100)}...`);
        } else {
          console.log(`Page ${i + 1}: Insufficient text extracted (${pageText?.length || 0} chars)`);
        }
      }
      
      // Clean up temp files
      try {
        if (fs.existsSync(tempPdfPath)) fs.unlinkSync(tempPdfPath);
        files.forEach(file => {
          const filePath = path.join(tempDir, file);
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        });
        if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
      } catch (cleanupError) {
        console.warn('Cleanup failed:', cleanupError);
      }
      
      if (fullText.trim().length > 50) {
        console.log(`✅ Enhanced PDF Vision processing successful: ${fullText.length} characters extracted`);
        return { success: true, content: fullText };
      } else {
        return { success: false, error: "Vision API extracted insufficient content despite high-quality image conversion" };
      }
      
    } catch (error) {
      console.error("Enhanced PDF Vision processing failed:", error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async processAsset(asset: Asset): Promise<void> {
    try {
      await storage.updateAsset(asset.id, { status: "processing" });

      let textContent = "";
      
      switch (asset.type) {
        case "pdf":
          textContent = await this.processPDF(asset);
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

      // Chunk the content
      const chunks = this.chunkText(textContent);
      
      // Generate embeddings and store chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await openaiService.generateEmbedding(chunk);
        
        await storage.createAssetChunk({
          assetId: asset.id,
          seq: i,
          text: chunk,
          embedding: JSON.stringify(embedding),
          tokens: this.estimateTokens(chunk),
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

  private async processPDF(asset: Asset): Promise<string> {
    if (!asset.url && !asset.fileRef) {
      throw new Error("No PDF source provided");
    }

    // Check if we have canvas knowledge data first (new system)
    try {
      const canvasKnowledge = await storage.getCanvasKnowledgeByAssetId(asset.id);
      if (canvasKnowledge && canvasKnowledge.extractedText) {
        console.log("Using extracted text from canvas knowledge for asset:", asset.id);
        return canvasKnowledge.extractedText;
      }
    } catch (error) {
      console.log("No canvas knowledge found for asset:", asset.id);
    }

    // Check metadata for extracted text
    const metaJson = asset.metaJson as any;
    if (metaJson?.extractedText) {
      return metaJson.extractedText;
    }

    // Fallback: return basic information about the PDF
    return `PDF 문서: ${asset.title}\n파일명: ${metaJson?.fileName || 'unknown'}\n크기: ${metaJson?.fileSize ? (metaJson.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'unknown'}`;
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

  private chunkText(text: string, maxChunkSize = 1000): string[] {
    const chunks: string[] = [];
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    let currentChunk = "";
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (trimmedSentence.length === 0) continue;
      
      if (currentChunk.length + trimmedSentence.length > maxChunkSize && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedSentence;
      } else {
        currentChunk += (currentChunk.length > 0 ? ". " : "") + trimmedSentence;
      }
    }
    
    if (currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks.length > 0 ? chunks : [text];
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

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
