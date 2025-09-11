/**
 * rag.ts - RAG 관련 타입 정의
 * 
 * 주요 역할:
 * 1. 캔버스 지식 RAG 파이프라인에서 사용하는 공통 타입 제공
 * 2. Knowledge 청크/인용/웹 인용 타입 명세화
 * 3. 서비스 계층 간 의존성 최소화를 위한 타입 분리
 * 
 * 핵심 특징:
 * - 명확한 도메인 타입으로 가독성과 안정성 향상
 * - UI/API/서비스 간 타입 일관성 유지
 * - any 타입 사용 지양, 필수 필드 명시
 * 
 * 주의사항:
 * - 실제 DB 스키마 변경 시 동기화 필요
 * - 불필요한 확장 금지, 필요한 범위 내에서만 정의
 */

export interface KnowledgeChunk {
  id: string;
  knowledge_id: string;
  text: string;
  similarity: number;
}

export interface KnowledgeCitation {
  kind: 'knowledge';
  chunkId: string;
  knowledgeId: string;
  title: string;
  snippet: string;
  similarity: number;
}

export interface WebCitation {
  kind: 'web';
  title: string;
  url: string;
  source?: string;
  snippet: string;
  relevanceScore: number | null;
}

export interface RAGUsedMeta {
  chunksMatched: number;
  webSearchUsed: boolean;
}

export interface BuildContextResult {
  knowledgeContext: string;
  knowledgeCitations: KnowledgeCitation[];
  webCitations: WebCitation[];
  webContext: string;
  ragUsed: RAGUsedMeta;
  actionDecision?: {
    action: 'KNOWLEDGE_ONLY' | 'WEB_SEARCH' | 'CLARIFY' | 'CONVERSATION_SUMMARY' | 'KNOWLEDGE_SUMMARY';
    reason?: string;
    searchQuery?: string | null;
    clarificationQuestion?: string | null;
  };
}


