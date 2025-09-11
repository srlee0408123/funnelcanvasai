-- Add description column to rag_prompts for admin explanations
ALTER TABLE public.rag_prompts
ADD COLUMN IF NOT EXISTS description TEXT;

-- Seed descriptions for known templates (idempotent updates by name)
UPDATE public.rag_prompts
SET description = '기본 페르소나/규칙. 컨텍스트 우선 답변, 정보 부족 시 인정, 간결한 서술. 전용 템플릿 부재 시 폴백 헤더로 사용.'
WHERE name = 'DEFAULT_SYSTEM_PROMPT' AND (description IS NULL OR description = '');

UPDATE public.rag_prompts
SET description = '최근 대화 맥락(히스토리) 요약용. 웹 검색 금지. 핵심 요점/결정/오픈 이슈 정리.'
WHERE name = 'CONVERSATION_SUMMARY_TEMPLATE' AND (description IS NULL OR description = '');

UPDATE public.rag_prompts
SET description = '업로드 지식/글로벌 지식 요약용. 원문 중심 컨텍스트를 최대 토큰으로 요약. 웹 검색 금지.'
WHERE name = 'KNOWLEDGE_SUMMARY_TEMPLATE' AND (description IS NULL OR description = '');

UPDATE public.rag_prompts
SET description = '웹 검색 기반 답변 가이드. 핵심 근거 요약과 출처 링크 포함을 강조.'
WHERE name = 'WEB_SEARCH_ANSWER_TEMPLATE' AND (description IS NULL OR description = '');


