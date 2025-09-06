/**
 * PerplexityService - Perplexity Chat Completions 연동 서비스
 * 
 * 주요 역할:
 * 1. Perplexity Chat Completions 호출로 답변 생성
 * 2. Perplexity가 제공하는 citations를 함께 수집/반환
 * 3. (옵션) 검색 결과 형태의 JSON 응답 파싱 유틸 제공
 * 
 * 핵심 특징:
 * - OpenAI Chat Completions 호환 포맷 사용
 * - 환경변수 기반 모델/엔드포인트/키 제어
 * - JSON 응답 파싱 폴백 처리
 * 
 * 주의사항:
 * - PERPLEXITY_API_KEY 또는 SONAR_API_KEY 필요
 * - 응답의 citations는 상위 레벨에 올 수 있으므로 안전 파싱
 * - JSON 포맷 강제 시 모델이 JSON을 보장하지 않을 수 있어 폴백 로직 포함
 */

import fetch from 'node-fetch';

export interface PerplexityAnswer {
  content: string;
  citations: string[];
}

interface PerplexityChatOptions {
  maxTokens?: number;
  temperature?: number;
}

interface PerplexityChatCompletionChoice {
  message: { role: string; content: string };
}

interface PerplexityChatCompletionResponse {
  id?: string;
  model?: string;
  created?: number;
  citations?: string[];
  choices: PerplexityChatCompletionChoice[];
}

export class PerplexityService {
  private readonly baseUrl: string = 'https://api.perplexity.ai';
  private readonly apiKey: string;
  private readonly model: string;

  constructor() {
    this.apiKey = process.env.PERPLEXITY_API_KEY || '';
    this.model = process.env.PERPLEXITY_MODEL || 'sonar-pro';
    if (!this.apiKey) {
      // 키가 없으면 호출 시 에러를 던지므로 여기서는 조용히 진행
    }
  }

  /**
   * Perplexity Chat Completions 호출로 답변 생성
   */
  async chat(systemPrompt: string, userPrompt: string, options?: PerplexityChatOptions): Promise<PerplexityAnswer> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key is not configured');
    }

    const max_tokens = options?.maxTokens ?? 2500;
    const temperature = options?.temperature ?? 0.2;

    const url = `${this.baseUrl}/chat/completions`;

    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens,
      temperature
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Perplexity request failed: ${response.status} ${response.statusText} ${errorText}`);
    }

    const data = (await response.json()) as PerplexityChatCompletionResponse;
    const content = data?.choices?.[0]?.message?.content ?? '';
    const citations = Array.isArray(data?.citations) ? data.citations : [];

    return { content, citations };
  }

  /**
   * 질의에 대한 검색 결과를 JSON 형태로 요청하고 파싱
   * - 모델이 JSON을 따르지 않는 경우를 대비해 관용적 파서 적용
   */
  async searchToResults(query: string, limit: number = 8): Promise<Array<{ title: string; link: string; snippet: string; source?: string }>> {
    if (!this.apiKey) {
      throw new Error('Perplexity API key is not configured');
    }

    const systemPrompt = `당신은 웹 검색 결과를 간결한 JSON으로만 반환하는 도우미입니다.
반드시 아래 JSON 스키마를 준수해 주세요. 여분의 텍스트, 마크다운, 설명, 코드블록 없이 순수 JSON만 반환합니다.
{
  "results": [
    { "title": string, "link": string, "snippet": string, "source": string }
  ]
}
결과는 최대 ${limit}개입니다. snippet은 160자 이내 한국어 요약으로 작성하세요.`;

    const { content } = await this.chat(systemPrompt, query, { maxTokens: 1200, temperature: 0.2 });

    // JSON 파싱 (코드펜스/여분 텍스트 제거 포함)
    const jsonText = this.extractJson(content);
    try {
      const parsed = JSON.parse(jsonText) as { results?: Array<{ title?: string; link?: string; snippet?: string; source?: string }> };
      const items = Array.isArray(parsed.results) ? parsed.results : [];
      return items
        .filter((r) => r && typeof r.link === 'string')
        .slice(0, limit)
        .map((r) => ({
          title: r.title || 'No title',
          link: r.link || '',
          snippet: r.snippet || '',
          source: r.source || (r.link ? this.extractDomain(r.link) : undefined)
        }));
    } catch {
      // JSON 파싱 실패 시 빈 결과
      return [];
    }
  }

  private extractJson(text: string): string {
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return text.slice(firstBrace, lastBrace + 1);
    }
    return text;
  }

  private extractDomain(url: string): string {
    try {
      const domain = new URL(url).hostname;
      return domain.replace('www.', '');
    } catch {
      return 'Unknown';
    }
  }
}


