-- RAG Prompts - Minimal secure schema for editable system instructions

-- Table
CREATE TABLE IF NOT EXISTS public.rag_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rag_prompts_created_at ON public.rag_prompts(created_at);
CREATE INDEX IF NOT EXISTS idx_rag_prompts_is_active ON public.rag_prompts(is_active);

-- RLS disabled; access control handled at API layer (consistent with other tables)
ALTER TABLE public.rag_prompts DISABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_rag_prompts_updated_at ON public.rag_prompts;
CREATE TRIGGER trg_rag_prompts_updated_at
BEFORE UPDATE ON public.rag_prompts
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();


