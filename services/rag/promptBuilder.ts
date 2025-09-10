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

/**
 * 지식 우선 사용 여부 판정을 위한 시스템 프롬프트
 * - 목표: 웹 검색을 최소화하고 지식 베이스 활용을 극대화
 * - 응답 형식: 반드시 'TRUE' 또는 'FALSE' 한 단어
 */
export function buildKnowledgeFirstDecisionPrompt(): string {
  return `당신은 '지식 베이스 활용 극대화 에이전트'입니다. 당신의 임무는 웹 검색(FALSE)을 최소화하고, 주어진 지식(TRUE)을 최대한 활용하도록 유도하는 것입니다. 지식 컨텍스트를 사용해서 답변의 '실마리'라도 제공할 수 있다면 무조건 TRUE를 반환하세요. 질문과 컨텍스트의 주제가 완전히 딴판이라 전혀 도움이 되지 않을 때만 FALSE를 반환하세요. 단, 사용자가 '최신' 또는 '실시간' 정보를 명확히 요구할 때는 예외적으로 FALSE를 고려할 수 있습니다. 응답은 반드시 'TRUE' 또는 'FALSE' 한 단어로만 하십시오.`;
}

export function buildSystemPrompt(knowledgeContext: string, historyText: string, externalInstruction?: string): string {
  const instruction = (externalInstruction || '').trim();
  const safeInstruction = instruction.length > 0 ? `${instruction}\n\n` : '';
  // 사용자 프롬프트(외부 지시문) + 고정 하단(컨텍스트/히스토리)
  return `${safeInstruction}참고 컨텍스트(지식 및 웹 요약 포함 가능):
${knowledgeContext || '컨텍스트가 충분하지 않습니다. 필요한 추가 정보를 요청하세요.'}

최근 대화 맥락:
${historyText || '대화 히스토리가 없습니다.'}`;
}

// (내부용) 히스토리 포맷터는 다른 모듈에서 정의/사용하도록 정리


// Deprecated 분기형 빌더 제거: 단일 buildSystemPrompt만 사용

