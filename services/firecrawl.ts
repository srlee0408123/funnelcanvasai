/**
 * firecrawl.ts - Firecrawl 웹 스크래핑 서비스 래퍼
 * 
 * 주요 역할:
 * 1. Firecrawl API(v2) 호출로 단일 URL 콘텐츠 스크래핑
 * 2. Markdown/HTML 결과에서 순수 텍스트를 안전하게 추출
 * 3. 호출 에러/레이트 리밋 대비 내고장성 처리
 * 
 * 핵심 특징:
 * - 환경변수 `FIRECRAWL_API_KEY` 기반 인증
 * - markdown 우선, 없으면 html → 텍스트 정제
 * - 반환 값은 { title, text } 표준화
 * 
 * 주의사항:
 * - Firecrawl Cloud 사용 전제. 사용량/요금 정책 확인 필요
 * - 대량 페이지 전체 크롤링은 /crawl 엔드포인트를 고려 (비동기 폴링 필요)
 */

type AnyObject = Record<string, any>;

export interface ScrapedResult {
  title: string;
  markdown: string; // 원본 저장용
  text: string;     // 청킹/임베딩용 순수 텍스트
}

export class FirecrawlService {
  private readonly apiKey: string;
  private readonly baseUrl: string = 'https://api.firecrawl.dev/v2';

  constructor(apiKey = process.env.FIRECRAWL_API_KEY || '') {
    this.apiKey = apiKey;
  }

  /**
   * 단일 URL 스크랩 → 텍스트 표준화
   */
  async scrapeToText(url: string): Promise<ScrapedResult> {
    if (!this.apiKey) {
      throw new Error('FIRECRAWL_API_KEY is not set');
    }
    if (!url) {
      throw new Error('URL is required');
    }

    const normalizedUrl = this.ensureHttpScheme(url);

    const res = await fetch(`${this.baseUrl}/scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        url: normalizedUrl,
        // 원문 구조 보존을 위해 markdown 우선 요청
        formats: ['markdown', 'html'],
        onlyMainContent: true,
      }),
    });

    if (!res.ok) {
      let msg = res.statusText;
      try {
        const t = await res.text();
        if (t) {
          try {
            const j = JSON.parse(t) as AnyObject;
            msg = (j && (j.error || j.message)) || t;
          } catch {
            msg = t;
          }
        }
      } catch {}
      throw new Error(`Firecrawl scrape failed: ${msg || `HTTP ${res.status}`}`);
    }

    const json = (await res.json()) as AnyObject;
    // Firecrawl는 HTTP API에서 최상위에 markdown/html/title 등을 반환할 수 있음
    const top: AnyObject = (json && typeof json === 'object' && json.data) ? json.data : json;

    const title = (top?.title || '').trim();
    const markdown = (top?.markdown || '').trim();
    const html = (top?.html || '').trim();

    const textFromMarkdown = markdown ? this.stripMarkdown(markdown) : '';
    const textFromHtml = !textFromMarkdown && html ? this.stripHtml(html) : '';

    const text = (textFromMarkdown || textFromHtml).trim();
    if (!text) {
      throw new Error('No text content returned by Firecrawl');
    }

    return {
      title: title || this.deriveTitleFromUrl(normalizedUrl),
      markdown: markdown || (html ? this.stripHtml(html) : ''),
      text: this.normalizeWhitespace(text),
    };
  }

  private ensureHttpScheme(inputUrl: string): string {
    try {
      // new URL이 실패하면 scheme이 없을 수 있음
      // schema 없으면 https://를 프리펜드
      if (!/^https?:\/\//i.test(inputUrl)) {
        return `https://${inputUrl}`;
      }
      return inputUrl;
    } catch {
      return inputUrl;
    }
  }

  private deriveTitleFromUrl(url: string): string {
    try {
      const u = new URL(url);
      return u.hostname.replace('www.', '');
    } catch {
      return 'Website';
    }
  }

  private normalizeWhitespace(text: string): string {
    return text.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
  }

  /** 간단한 Markdown 제거 (헤더/링크/코드블록 등) */
  private stripMarkdown(md: string): string {
    try {
      return md
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]*`/g, ' ')
        .replace(/^\s{0,3}(#{1,6})\s+/gm, ' ')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/>\s?/g, ' ')
        .replace(/[-*_]{3,}/g, ' ')
        .replace(/\|/g, ' ')
        .replace(/\s+/g, ' ');
    } catch {
      return md;
    }
  }

  /** 매우 단순한 HTML 태그 제거 */
  private stripHtml(html: string): string {
    try {
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ');
    } catch {
      return html;
    }
  }
}

export const firecrawlService = new FirecrawlService();

// 외부에서 마크다운 → 텍스트 변환이 필요할 수 있어 헬퍼 제공
export function markdownToPlainText(markdown: string): string {
  const svc = new FirecrawlService('dummy');
  // private 메서드 접근 불가하므로 동일 로직 복제 (간결 버전)
  try {
    return markdown
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/`[^`]*`/g, ' ')
      .replace(/^\s{0,3}(#{1,6})\s+/gm, ' ')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/>\s?/g, ' ')
      .replace(/[-*_]{3,}/g, ' ')
      .replace(/\|/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  } catch {
    return markdown;
  }
}


