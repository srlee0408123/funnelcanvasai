/**
 * openai.ts - OpenAI 연동 서비스 (챗/비전/임베딩)
 *
 * 주요 역할:
 * 1. 범용 챗 응답 생성 및 RAG 시스템 지원
 * 2. 비전 모델을 통한 이미지 분석 및 OCR 텍스트 추출
 * 3. 텍스트 임베딩 생성 (벡터 검색용)
 *
 * 핵심 특징:
 * - 모델명을 환경 변수로 분리하여 유연한 교체 지원
 * - 오류 로깅 일관화 및 상위 레이어로 예외 전파
 * - RAG 시스템의 핵심 인프라 제공
 *
 * 주의사항:
 * - OPENAI_DEFAULT_MODEL/OPENAI_VISION_MODEL/OPENAI_EMBEDDINGS_MODEL 환경 변수 사용
 * - 서버 환경에서만 사용
 */
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

  /**
   * 범용 챗 응답 생성 (시스템/유저 프롬프트 전달)
   */
  async chat(systemPrompt: string, userPrompt: string, options?: { maxTokens?: number; temperature?: number; presencePenalty?: number; frequencyPenalty?: number; }): Promise<string> {
    const max_tokens = options?.maxTokens ?? 2500;
    const temperature = options?.temperature ?? 0.2;
    const presence_penalty = options?.presencePenalty ?? 0.1;
    const frequency_penalty = options?.frequencyPenalty ?? 0.1;

    try {
      const response = await openai.chat.completions.create({
        model: this.chatModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens,
        temperature,
        presence_penalty,
        frequency_penalty,
      });
      return response.choices[0].message.content || '';
    } catch (error) {
      console.error('Error generating chat completion:', error);
      throw new Error('Failed to generate chat completion');
    }
  }
}