/**
 * textChunker.ts - 텍스트 청킹 공용 유틸리티
 * 
 * 주요 역할:
 * 1. LangChain Splitter로 텍스트를 일관된 크기로 청킹
 * 2. 토큰 수 대략 추정 유틸리티 제공
 * 
 * 핵심 특징:
 * - 전역 상수 CHUNK_SIZE/CHUNK_OVERLAP를 단일 소스에서 관리
 * - 모든 서버 사이드 인입/업로드 경로에서 재사용하여 DRY 보장
 * 
 * 주의사항:
 * - LangChain Splitter는 비동기 API이므로 buildChunks는 async 함수입니다.
 */

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

export const CHUNK_SIZE = 1500
export const CHUNK_OVERLAP = 200

/**
 * 텍스트를 일정 크기의 청크 배열로 분할
 */
export async function buildChunks(fullText: string, options?: { chunkSize?: number; chunkOverlap?: number }): Promise<string[]> {
  const text = typeof fullText === 'string' ? fullText : ''
  if (!text || text.trim().length === 0) return []

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: options?.chunkSize ?? CHUNK_SIZE,
    chunkOverlap: options?.chunkOverlap ?? CHUNK_OVERLAP,
  })
  return await splitter.splitText(text)
}

/**
 * 간단한 토큰 수 추정 (영문 기준 1토큰≈4자)
 */
export function estimateTokens(text: string): number {
  const input = typeof text === 'string' ? text : ''
  if (!input) return 0
  return Math.ceil(input.length / 4)
}


