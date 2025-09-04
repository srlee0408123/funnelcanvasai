import { NextRequest, NextResponse } from 'next/server';
import { WebSearchService } from '@/services/webSearch';

/**
 * 웹 검색 API 엔드포인트
 * 
 * POST /api/search
 * - query: 검색어
 * - numResults: 결과 개수 (기본값: 8)
 */

const webSearchService = new WebSearchService();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, numResults = 8 } = body;

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: '검색어가 필요합니다.' },
        { status: 400 }
      );
    }

    console.log(`🔍 Web search request: "${query}"`);

    // 웹 검색 실행
    const searchResponse = await webSearchService.searchWeb(query, numResults);

    console.log(`✅ Search completed: ${searchResponse.results.length} results in ${searchResponse.searchTime}ms`);

    return NextResponse.json({
      success: true,
      results: searchResponse.results,
      searchTime: searchResponse.searchTime,
      totalResults: searchResponse.totalResults,
      searchTerm: searchResponse.searchTerm
    });

  } catch (error) {
    console.error('Search API error:', error);
    
    return NextResponse.json(
      { 
        error: '검색 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { 
      message: 'Web Search API',
      usage: 'POST /api/search with { query: string, numResults?: number }'
    },
    { status: 200 }
  );
}
