/**
 * openai.ts - OpenAI 연동 서비스 (챗/비전/임베딩)
 * 
 * 주요 역할:
 * 1. 퍼널 피드백 생성, 요약/키워드 추출 등 챗 기반 기능 제공
 * 2. 비전 모델을 통한 이미지/페이지 OCR 텍스트 추출
 * 3. 텍스트 임베딩 생성
 * 
 * 핵심 특징:
 * - 모델명을 환경 변수로 분리하여 유연한 교체 지원
 * - JSON 응답 강제(response_format)로 파싱 안정성 향상
 * - 오류 로깅 일관화 및 상위 레이어로 예외 전파
 * 
 * 주의사항:
 * - OPENAI_DEFAULT_MODEL/OPENAI_VISION_MODEL/OPENAI_EMBEDDINGS_MODEL 환경 변수 사용
 * - 서버 환경에서만 사용
 */
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface FunnelAnalysisRequest {
  flowJson: any;
  knowledgeBase: { source: string; title: string; content: string }[];
  userGoals?: string;
  industry?: string;
}

export interface FeedbackItem {
  nodeId: string;
  suggestion: string;
  severity: "low" | "medium" | "high";
  rationale: string;
}

export class OpenAIService {
  // 기본/비전/임베딩 모델은 환경 변수로 제어
  private readonly chatModel = process.env.OPENAI_DEFAULT_MODEL || "gpt-4o";
  private readonly visionModel = process.env.OPENAI_VISION_MODEL || "gpt-4o";
  // Unify on GPT embeddings v3 (small): 1536 dims, cost-effective
  private readonly embeddingsModel = process.env.OPENAI_EMBEDDINGS_MODEL || "text-embedding-3-small";

  public getChatModelName(): string {
    return this.chatModel;
  }

  public getVisionModelName(): string {
    return this.visionModel;
  }

  public getEmbeddingsModelName(): string {
    return this.embeddingsModel;
  }

  async generateFunnelFeedback(request: FunnelAnalysisRequest): Promise<FeedbackItem[]> {
    try {
      const prompt = this.buildFeedbackPrompt(request);

      const response = await openai.chat.completions.create({
        model: this.chatModel,
        messages: [
          {
            role: "system",
            content: "You are a funnel optimization expert. Analyze the provided funnel and give specific, actionable feedback. Respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result.feedback || [];
    } catch (error) {
      console.error("Error generating funnel feedback:", error);
      throw new Error("Failed to generate AI feedback");
    }
  }

  async generateContentSummary(content: string, maxLength: number = 50): Promise<string> {
    try {
      const prompt = `다음 내용을 ${maxLength}자 이내로 핵심만 간단히 요약해주세요. 제목처럼 사용할 수 있는 한 문장으로 만들어주세요.

내용: ${content}

응답은 요약된 제목만 제공하세요.`;

      const response = await openai.chat.completions.create({
        model: this.chatModel,
        messages: [
          {
            role: "system",
            content: "You are an expert content summarizer. Create concise, meaningful titles from content."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 100,
      });

      return response.choices[0].message.content?.trim() || "요약된 내용";
    } catch (error) {
      console.error("Error generating content summary:", error);
      return "AI 분석 내용";
    }
  }

  async extractKeyTopics(content: string, maxTopics: number = 3): Promise<string[]> {
    try {
      const prompt = `다음 내용에서 핵심 주제나 키워드를 정확히 ${maxTopics}개만 추출해주세요. 가장 중요하고 구체적인 마케팅/비즈니스 관련 용어를 선택하세요.

내용: ${content.substring(0, 2000)} ${content.length > 2000 ? '...' : ''}

응답은 JSON 형식으로 제공하고, 정확히 ${maxTopics}개의 키워드만 포함하세요:
{"topics": ["키워드1", "키워드2", "키워드3"]}`;

      const response = await openai.chat.completions.create({
        model: this.chatModel,
        messages: [
          {
            role: "system",
            content: "You are an expert at extracting key topics and keywords from content. Return only valid JSON with exactly the requested number of topics."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      const topics = result.topics || [];
      return topics.slice(0, maxTopics); // 정확히 maxTopics 개수만큼만 반환
    } catch (error) {
      console.error("Error extracting key topics:", error);
      return ["마케팅", "비즈니스", "전략"];
    }
  }

  async processImageWithVision(base64Image: string, prompt: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${base64Image}`,
                  detail: "high"
                },
              },
            ],
          },
        ],
        max_tokens: 4000,
        temperature: 0.1,
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      console.error("Error processing image with Vision API:", error);
      throw new Error(`Vision API processing failed: ${(error as Error).message}`);
    }
  }

  async enhanceContent(content: string, contentType: string, context?: string): Promise<string> {
    try {
      const prompt = context || `다음 ${contentType} 내용을 마케팅 퍼널 전문가 관점에서 분석하고 구조화해주세요:

${content}

깨진 텍스트나 불완전한 정보가 있다면 맥락을 파악해서 의미있는 내용으로 해석해주세요.`;

      const response = await openai.chat.completions.create({
        model: this.chatModel,
        messages: [
          {
            role: "system",
            content: "You are an expert business analyst and marketing funnel strategist. You can interpret fragmented or poorly extracted text and transform it into actionable business insights. Focus on practical applications and real-world value."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.4,
        max_tokens: 2000,
      });

      return response.choices[0].message.content || content;
    } catch (error) {
      console.error("Error enhancing content:", error);
      throw new Error("Failed to enhance content");
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await openai.embeddings.create({
        model: this.embeddingsModel,
        input: text,
      });

      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate embedding");
    }
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    try {
      const response = await openai.embeddings.create({
        model: this.embeddingsModel,
        input: texts,
      });
      return response.data.map(d => d.embedding);
    } catch (error) {
      console.error("Error generating batch embeddings:", error);
      throw new Error("Failed to generate batch embeddings");
    }
  }

  async extractTextFromImage(base64Image: string): Promise<string> {
    try {
      const response = await openai.chat.completions.create({
        model: this.visionModel,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract all text from this image. Preserve formatting and structure as much as possible."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${base64Image}`
                }
              }
            ],
          },
        ],
        max_tokens: 1000,
      });

      return response.choices[0].message.content || "";
    } catch (error) {
      console.error("Error extracting text from image:", error);
      throw new Error("Failed to extract text from image");
    }
  }

  async analyzePDFContent(base64Pdf: string, filename: string): Promise<string> {
    try {
      const prompt = `PDF 파일 "${filename}"를 분석해서 핵심 내용을 추출해주세요.

다음과 같은 형식으로 체계적으로 정리해주세요:

📄 **문서 제목**: [문서의 주제나 제목]

🎯 **주요 목적**: [문서의 목적이나 목표]

📋 **핵심 내용**:
- [주요 포인트 1]
- [주요 포인트 2] 
- [주요 포인트 3]

💡 **핵심 인사이트**:
- [중요한 통찰이나 결론 1]
- [중요한 통찰이나 결론 2]

🔧 **실행 가능한 액션**:
- [구체적인 실행 방안 1]
- [구체적인 실행 방안 2]

이 PDF는 마케팅 퍼널과 비즈니스 성장에 관련된 전문 지식이므로, 그 관점에서 분석해주세요.`;

      const response = await openai.chat.completions.create({
        model: this.chatModel,
        messages: [
          {
            role: "system",
            content: "You are an expert business analyst specializing in marketing funnels and business growth strategies. Analyze documents thoroughly and extract actionable insights."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        max_tokens: 1500,
        temperature: 0.3,
      });

      return response.choices[0].message.content || `PDF 파일 "${filename}"에 대한 분석을 완료했습니다. 마케팅 퍼널과 비즈니스 전략에 관련된 전문 지식이 포함되어 있습니다.`;
    } catch (error) {
      console.error("Error analyzing PDF content:", error);
      throw new Error("Failed to analyze PDF content");
    }
  }

  async extractAndEnhancePDFWithVision(pdfBuffer: Buffer, filename: string): Promise<{ extractedText: string, aiEnhancement: string }> {
    console.log("=== Starting Vision API PDF Processing ===");
    console.log(`PDF buffer size: ${pdfBuffer.length} bytes`);
    console.log(`Filename: ${filename}`);
    
    try {
      console.log("Step 1: Loading pdf2pic library...");
      const pdf2pic = await import('pdf2pic');
      console.log("pdf2pic loaded successfully");
      
      console.log("Step 2: Setting up PDF conversion...");
      const convert = pdf2pic.fromBuffer(pdfBuffer, {
        density: 100, // Lower density for testing
        saveFilename: "page",
        savePath: "/tmp/",
        format: "png",
        width: 1200,
        height: 1200
      });
      console.log("PDF converter configured");

      console.log("Step 3: Converting PDF to images...");
      const results = await convert.bulk(-1);
      console.log(`PDF conversion completed: ${results.length} pages converted`);
      
      let allExtractedText = "";
      
      // Process each page with OpenAI Vision API
      for (let i = 0; i < Math.min(results.length, 3); i++) { // Limit to first 3 pages to avoid token limits
        const result = results[i] as any;
        console.log(`Checking result ${i + 1}:`, !!result, typeof result, Object.keys(result || {}));
        
        if (result && result.path) {
          console.log(`Processing page ${i + 1} with OpenAI Vision API...`);
          
          try {
            // Read image file and convert to base64
            const fs = await import('fs');
            const imageBuffer = fs.readFileSync(result.path);
            const base64Data = imageBuffer.toString('base64');
            console.log(`Read image from path: ${result.path}, size: ${base64Data.length}`);
            
            const pageText = await this.extractTextFromImage(base64Data);
            if (pageText && pageText.trim()) {
              allExtractedText += `\n=== 페이지 ${i + 1} ===\n${pageText}\n`;
              console.log(`Page ${i + 1} processed successfully, extracted ${pageText.length} characters`);
            } else {
              console.log(`Page ${i + 1}: No text extracted`);
            }
          } catch (pageError) {
            console.error(`Error processing page ${i + 1}:`, pageError);
            // Continue with other pages even if one fails
          }
        } else {
          console.log(`Page ${i + 1}: Invalid result structure - no path`);
        }
      }
      
      console.log(`Step 5: Checking extracted text quality...`);
      console.log(`Total extracted text length: ${allExtractedText.length} characters`);
      
      if (!allExtractedText || allExtractedText.trim().length < 20) {
        console.error("Insufficient text extracted from Vision API");
        console.error(`Extracted text: "${allExtractedText}"`);
        throw new Error(`OpenAI Vision API로부터 충분한 텍스트를 추출하지 못했습니다. 추출된 텍스트: ${allExtractedText.length}자`);
      }

      console.log(`Step 6: Vision API 텍스트 추출 성공! 총 ${allExtractedText.length}자 추출됨`);
      console.log("샘플 텍스트:", allExtractedText.substring(0, 200));

      // Now enhance the extracted content with AI analysis
      const analysisPrompt = `다음은 PDF "${filename}"에서 OpenAI Vision API로 추출한 고품질 텍스트입니다. 이를 마케팅 퍼널 전문가 관점에서 분석하고 구조화해주세요:

${allExtractedText}

다음 형식으로 체계적으로 정리해주세요:

📄 **문서 제목**: [내용을 바탕으로 한 명확한 제목]
🎯 **주요 목적**: [문서의 핵심 목적]
📋 **핵심 내용**: 
- [주요 포인트 1 - 구체적으로]
- [주요 포인트 2 - 구체적으로] 
- [주요 포인트 3 - 구체적으로]
💡 **핵심 인사이트**: 
- [실무 활용 가능한 통찰 1]
- [실무 활용 가능한 통찰 2]
🔧 **실행 방안**: 
- [구체적인 액션 플랜 1]
- [구체적인 액션 플랜 2]

마케팅 퍼널과 비즈니스 성장 관점에서 실무에 바로 활용할 수 있는 가치 있는 정보로 재구성해주세요.`;

      const enhancementResponse = await openai.chat.completions.create({
        model: this.chatModel,
        messages: [
          {
            role: "system",
            content: "You are an expert business analyst and marketing funnel strategist. Transform extracted content into actionable business insights with clear structure and practical value."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        max_tokens: 2500,
        temperature: 0.3,
      });

      const aiEnhancement = enhancementResponse.choices[0].message.content || "";

      return {
        extractedText: allExtractedText.trim(),
        aiEnhancement: aiEnhancement.trim()
      };

    } catch (error) {
      console.error("=== Vision API PDF Processing Failed ===");
      console.error("Error details:", error);
      console.error("Error type:", typeof error);
      console.error("Error message:", error instanceof Error ? error.message : String(error));
      console.error("Stack trace:", error instanceof Error ? error.stack : 'No stack trace');
      throw new Error(`OpenAI Vision을 통한 PDF 처리에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async enhancePDFContent(extractedText: string, filename: string): Promise<string> {
    try {
      // Enhance the extracted content with AI analysis
      const analysisPrompt = `다음은 PDF "${filename}"에서 추출한 텍스트입니다. 이를 마케팅 퍼널 전문가 관점에서 분석하고 구조화해주세요:

${extractedText}

다음 형식으로 체계적으로 정리해주세요:

📄 **문서 제목**: [내용을 바탕으로 한 명확한 제목]
🎯 **주요 목적**: [문서의 핵심 목적]
📋 **핵심 내용**: 
- [주요 포인트 1 - 구체적으로]
- [주요 포인트 2 - 구체적으로] 
- [주요 포인트 3 - 구체적으로]
💡 **핵심 인사이트**: 
- [실무 활용 가능한 통찰 1]
- [실무 활용 가능한 통찰 2]
🔧 **실행 방안**: 
- [구체적인 액션 플랜 1]
- [구체적인 액션 플랜 2]

마케팅 퍼널과 비즈니스 성장 관점에서 실무에 바로 활용할 수 있는 가치 있는 정보로 재구성해주세요.`;

      const enhancementResponse = await openai.chat.completions.create({
        model: this.chatModel,
        messages: [
          {
            role: "system",
            content: "You are an expert business analyst and marketing funnel strategist. Transform extracted content into actionable business insights with clear structure and practical value."
          },
          {
            role: "user",
            content: analysisPrompt
          }
        ],
        max_tokens: 2500,
        temperature: 0.3,
      });

      return enhancementResponse.choices[0].message.content || "";

    } catch (error) {
      console.error("Error in OpenAI PDF enhancement:", error);
      throw new Error(`OpenAI를 통한 PDF 개선에 실패했습니다: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private buildFeedbackPrompt(request: FunnelAnalysisRequest): string {
    const { flowJson, knowledgeBase, userGoals, industry } = request;

    const kbSummary = knowledgeBase
      .map(kb => `Source: ${kb.source}\nTitle: ${kb.title}\nContent: ${kb.content.substring(0, 500)}...`)
      .join('\n\n');

    return `Analyze this marketing funnel and provide specific feedback:

FUNNEL STRUCTURE:
${JSON.stringify(flowJson, null, 2)}

KNOWLEDGE BASE:
${kbSummary}

${userGoals ? `USER GOALS: ${userGoals}` : ''}
${industry ? `INDUSTRY: ${industry}` : ''}

Please analyze the funnel based on best practices and the provided knowledge base. For each issue or recommendation, provide:

1. The specific node ID that needs attention
2. A clear, actionable suggestion
3. Severity level (low/medium/high) 
4. Rationale explaining why this is important

Focus on:
- Conversion optimization
- User experience flow
- Content effectiveness  
- Technical implementation
- Industry best practices

Respond with JSON in this exact format:
{
  "feedback": [
    {
      "nodeId": "string",
      "suggestion": "string", 
      "severity": "low|medium|high",
      "rationale": "string"
    }
  ]
}`;
  }
}