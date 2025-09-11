/**
 * promptBuilder.ts - 시스템 프롬프트 및 히스토리 포맷터
 * 
 * 주요 역할:
 * 1. 행동 결정 프롬프트 구성 (지식/웹/혼합/질문 명확화)
 * 2. 답변 합성 프롬프트 구성 (페르소나+규칙 기반, 환각 최소화)
 * 3. 시스템 프롬프트 공통 헤더(페르소나/규칙) 제공 및 관리
 * 
 * 핵심 특징:
 * - 행동 결정: 4가지 액션 유형으로 세분화해 동적 검색어와 근거를 함께 생성
 * - 답변 합성: 컨텍스트 우선주의 규칙으로 환각을 억제하고 일관된 답변 스타일 유지
 * - Admin용 프롬프트 헤더 템플릿을 상수로 제공하여 운영 환경에서 손쉽게 교체 가능
 * 
 * 주의사항:
 * - 외부 지시문(externalInstruction)이 주어지지 않은 경우에만 기본 헤더를 자동 주입합니다
 * - 외부 지시문을 사용할 때는 중복된 규칙 안내가 겹치지 않도록 주의하세요
 */

/**
 * 지식 우선 사용 여부 판정을 위한 시스템 프롬프트
 * - 목표: 웹 검색을 최소화하고 지식 베이스 활용을 극대화
 * - 응답 형식: 반드시 'TRUE' 또는 'FALSE' 한 단어
 */

// (내부용) 히스토리 포맷터는 다른 모듈에서 정의/사용하도록 정리


// Deprecated 분기형 빌더 제거: 단일 buildSystemPrompt만 사용


/**
 * Admin에서 저장/관리하기 위한 기본 시스템 프롬프트 헤더(페르소나/규칙)
 * - 운영 중 외부 지시문(externalInstruction)으로 주입하여 교체 가능
 */
export const DEFAULT_SYSTEM_PROMPT_HEADER = `당신은 주어진 '참고 컨텍스트'를 기반으로 사용자에게 가장 정확하고 도움이 되는 답변을 제공하는 AI 전문가입니다. 아래의 <규칙>을 반드시 준수하여 답변을 생성하세요.

<규칙>
1. 컨텍스트 우선주의: 답변은 반드시 <참고 컨텍스트>에 명시된 내용에 근거해야 합니다. 당신의 사전 지식을 활용하여 컨텍스트 내용을 보충 설명할 수는 있지만, 컨텍스트와 상충되는 내용은 절대로 언급해서는 안 됩니다.
2. 정보 부족 시 인정: <참고 컨텍스트> 내에서 사용자의 질문에 대한 답변을 찾을 수 없는 경우, "죄송하지만, 제공된 정보 내에서는 해당 질문에 대한 답변을 찾을 수 없습니다."라고 명확하게 답변해야 합니다. 절대로 추측하거나 정보를 지어내지 마세요.
3. 출처 명시(Citation): 답변 내용이 어떤 컨텍스트에서 비롯되었는지 명시하면 신뢰도를 높일 수 있습니다. (예: "...라는 특징이 있습니다 [출처: 기술문서 A-1].") ※ 시스템 구현에 따라 선택적으로 적용
4. 대화 맥락 활용: <최근 대화 맥락>을 참고하여 사용자의 이전 질문과 의도를 파악하고, 현재 질문에 더 적절하고 연결성 있는 답변을 제공하세요.
5. 간결하고 명확하게: 전문 용어 사용을 최소화하고, 누구나 이해하기 쉽게 핵심을 요약하여 답변하세요.`;

/**
 * Admin 페이지에서 기본값으로 저장/노출할 수 있는 텍스트 템플릿
 * - 필요 시 그대로 externalInstruction으로 전달하여 사용
 */
export const ADMIN_SYSTEM_PROMPT_TEMPLATE = DEFAULT_SYSTEM_PROMPT_HEADER;

/**
 * 사용자 질문에 대한 최적 행동 결정을 위한 시스템 프롬프트
 * - 목표: 단순 지식/검색 판단을 넘어, 가장 효과적인 정보 수집 및 답변 계획 수립
 * - 응답 형식: 반드시 JSON 형식으로 지정된 행동 유형과 근거 반환
 */
export function buildOptimalActionDecisionPrompt(userQuery: string, knowledgeSnippet: string): string {
  const actionTypes = [
    `1. KNOWLEDGE_ONLY: 주어진 '초기 컨텍스트'만으로 충분히 완벽한 답변이 가능할 때 선택합니다. (예: 회사 내부 정책 질문)`,
    `2. WEB_SEARCH: '초기 컨텍스트'가 전혀 없거나, 사용자가 명백히 '최신', '실시간', '특정 외부 정보'(예: 특정 인물, 최신 뉴스, 경쟁사 정보)를 요구할 때 선택합니다. 검색이 필요한 경우, 최적의 검색어(searchQuery)를 반드시 생성해야 합니다.`,
    `3. CLARIFY: 사용자의 질문이 너무 모호하여 KNOWLEDGE 또는 WEB 중 어느 것을 사용해야 할지 판단하기 어려울 때 선택합니다. 사용자에게 되물을 질문(clarificationQuestion)을 생성해야 합니다.`,
    `4. CONVERSATION_SUMMARY: 사용자가 '대화/채팅/so far/conversation/지금까지' 등 대화 자체의 요약을 명시적으로 요청할 때 선택합니다. 최근 대화 맥락(historyText)을 요약 대상으로 간주하며, 웹 검색은 금지합니다.`,
    `5. KNOWLEDGE_SUMMARY: 사용자가 '지식/자료/업로드/context/컨텍스트/knowledge' 요약을 요청할 때 선택합니다. 내부/글로벌 지식(knowledgeSnippet)을 요약 대상으로 간주하며, 웹 검색은 금지하고 가능한 한 많은 최근 관련 내용을 포함해 Max token으로 요약합니다.`
  ];
  return `당신은 사용자의 질문 의도를 분석하여 최적의 답변 전략을 수립하는 'RAG 전략가'입니다.
주어진 <사용자 질문>과 <초기 컨텍스트>(내부 지식 검색의 핵심 결과 요약)를 바탕으로, 아래 ${actionTypes.length}가지 행동 유형 중 가장 적절한 것을 하나만 선택하고 그 이유를 설명하세요.

<사용자 질문>
${userQuery}

<초기 컨텍스트>
${knowledgeSnippet || '제공된 초기 컨텍스트 없음'}

<지시사항>
- ${actionTypes.join('\n')}
- 당신의 결정과 근거를 아래 JSON 형식으로만 응답해야 합니다. 다른 어떤 설명도 추가하지 마십시오.

<응답 형식>
{
  "action": "KNOWLEDGE_ONLY | WEB_SEARCH | CLARIFY | CONVERSATION_SUMMARY | KNOWLEDGE_SUMMARY",
  "reason": "왜 이 행동을 선택했는지에 대한 구체적인 근거 (1-2 문장으로 요약)",
  "searchQuery": "WEB_SEARCH 선택 시, 실행할 검색어. 그 외에는 null",
  "clarificationQuestion": "CLARIFY 선택 시, 사용자에게 할 질문. 그 외에는 null"
}`;
}

/**
 * 답변 합성(Answer Synthesis)용 시스템 프롬프트
 * - 페르소나와 규칙을 부여하여 컨텍스트 우선 답변을 강제합니다
 */
export function buildAnswerSynthesisPrompt(
  knowledgeContext: string,
  historyText: string,
  userQuery: string,
  externalInstruction?: string
): string {
  const instruction = (externalInstruction || '').trim();
  const header = instruction.length > 0 ? instruction : DEFAULT_SYSTEM_PROMPT_HEADER;
  return `${header}\n\n<참고 컨텍스트>\n${knowledgeContext || '현재 활용 가능한 참고 컨텍스트가 없습니다.'}\n\n<최근 대화 맥락>\n${historyText || '대화 히스토리가 없습니다.'}\n\n<사용자 질문>\n${userQuery}\n\n이제 위의 규칙에 따라 사용자의 질문에 답변하세요.`;
}

/**
 * 대화 요약용 시스템 프롬프트 빌더 (Admin 지시문 주입 가능)
 * - 입력: 최근 대화 맥락 텍스트
 */
export function buildConversationSummaryPrompt(historyText: string, externalInstruction?: string): string {
  const instruction = (externalInstruction || '').trim();
  const header = instruction.length > 0 ? instruction : DEFAULT_SYSTEM_PROMPT_HEADER;
  return `${header}\n\n당신은 전문 대화 요약가입니다. 아래 최근 대화 맥락을 읽고 핵심 요점, 결정사항, 열린 이슈/후속 작업을 한국어로 간결히 정리하세요. 불필요한 중복은 제거하고, 항목별로 번호 목록을 사용하세요.\n\n<최근 대화 맥락>\n${historyText || '대화 히스토리가 없습니다.'}`;
}

/**
 * 지식/데이터 요약용 시스템 프롬프트 빌더 (Admin 지시문 주입 가능)
 * - 입력: 요약 대상 컨텍스트 텍스트 (원문 중심)
 */
export function buildKnowledgeSummaryPrompt(contextText: string, externalInstruction?: string): string {
  const instruction = (externalInstruction || '').trim();
  const header = instruction.length > 0 ? instruction : DEFAULT_SYSTEM_PROMPT_HEADER;
  return `${header}\n\n당신은 기술 문서를 요약하는 전문가입니다. 아래 컨텍스트(내부/글로벌 지식 및 관련 맥락)를 읽고 핵심 주제, 주요 사실, 수치/예시, 결론을 한국어로 명확하게 요약하세요. 가능한 경우 소제목과 불릿을 활용하세요.\n\n<참고 컨텍스트>\n${contextText || '컨텍스트가 없습니다.'}`;
}

/**
 * 웹 검색 기반 답변용 시스템 프롬프트 빌더 (Admin 지시문 주입 가능)
 * - Perplexity 등 외부 검색에 사용할 가벼운 헤더
 */
export function buildWebSearchAnswerPrompt(externalInstruction?: string): string {
  const instruction = (externalInstruction || '').trim();
  const header = instruction.length > 0 ? instruction : DEFAULT_SYSTEM_PROMPT_HEADER;
  return `${header}\n\n당신은 웹 검색을 통해 최신 정보를 찾아 한국어로 명확하고 간결하게 답변하는 어시스턴트입니다. 반드시 핵심 근거를 요약하고, 가능한 경우 출처 링크를 포함하세요.`;
}

// (선택) JSON 파서 사용 시 참고 가능한 타입 정의
export type OptimalAction = 'KNOWLEDGE_ONLY' | 'WEB_SEARCH' | 'CLARIFY' | 'CONVERSATION_SUMMARY' | 'KNOWLEDGE_SUMMARY';
export interface OptimalActionDecisionResponse {
  action: OptimalAction;
  reason: string;
  searchQuery: string | null;
  clarificationQuestion: string | null;
}
