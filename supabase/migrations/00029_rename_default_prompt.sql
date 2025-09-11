-- Rename the seeded default prompt to an English canonical name
UPDATE public.rag_prompts
SET name = 'DEFAULT_SYSTEM_PROMPT'
WHERE name = '기본 시스템 프롬프트';

-- Ensure a single active default exists (no-op if already the latest)
-- Optional: keep as is; we only rename.


