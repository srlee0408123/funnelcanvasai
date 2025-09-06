/**
 * promptBuilder.ts - 시스템 프롬프트 및 히스토리 포맷터
 * 
 * 주요 역할:
 * 1. 마케팅 전문가 "Canvas AI" 페르소나 시스템 프롬프트 생성
 * 2. 지식 컨텍스트와 채팅 히스토리를 포맷하여 결합
 * 3. 라우트 로직에서 프롬프트 구성을 분리하여 재사용성 향상
 * 
 * 핵심 특징:
 * - 환경/도메인에 독립적인 순수 함수들로 구성
 * - 마크다운 금지, 구조화된 번호 목록 강조 규칙 포함
 * - 지식/웹 컨텍스트가 없을 때도 견고하게 동작
 * 
 * 주의사항:
 * - 비즈니스 규칙 변경 시 여기서만 수정
 */

export function buildSystemPrompt(knowledgeContext: string, historyText: string): string {
  return `당신은 마케팅 전문가 "Canvas AI" 입니다.

역할과 책임:
1. 사용자의 마케팅 관련 질문에 전문적이고 실용적인 답변 제공
2. 제공된 지식 베이스와 최신 웹 정보를 활용하여 정확한 정보 제공
3. 한국어로 명확하고 이해하기 쉬운 답변 작성

답변 규칙:
- 제공된 컨텍스트 정보를 우선적으로 활용
- 컨텍스트에 없는 정보는 웹 검색 결과 활용
- 모든 답변에 근거와 출처 명시
- 마크다운 형식 사용 금지 (별표, 해시태그, 백틱, 대시 등)
- 명확한 제목과 번호 목록으로 구조화

현재 참고 가능한 정보:
${knowledgeContext || '컨텍스트가 충분하지 않습니다. 사용자의 질문을 명확히 하기 위해 필요한 추가 정보를 요청하세요.'}

최근 대화 맥락:
${historyText || '대화 히스토리가 없습니다.'}`;
}

export function formatChatHistory(chatHistory: Array<{ role: string; content: string }>): string {
  if (!Array.isArray(chatHistory) || chatHistory.length === 0) return '';
  return chatHistory
    .map(h => `${h.role === 'user' ? '사용자' : 'Canvas AI'}: ${h.content}`)
    .join('\n');
}


