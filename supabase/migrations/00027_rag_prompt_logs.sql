-- RAG Prompt Logs - append-only change history

CREATE TABLE IF NOT EXISTS public.rag_prompt_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID NOT NULL REFERENCES public.rag_prompts(id) ON DELETE CASCADE,
  name_before TEXT,
  name_after TEXT,
  content_before TEXT,
  content_after TEXT,
  is_active_before BOOLEAN,
  is_active_after BOOLEAN,
  version_before INTEGER,
  version_after INTEGER,
  changed_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX IF NOT EXISTS idx_rag_prompt_logs_prompt_id ON public.rag_prompt_logs(prompt_id);
CREATE INDEX IF NOT EXISTS idx_rag_prompt_logs_changed_at ON public.rag_prompt_logs(changed_at);

-- RLS disabled; access via API routes only
ALTER TABLE public.rag_prompt_logs DISABLE ROW LEVEL SECURITY;


