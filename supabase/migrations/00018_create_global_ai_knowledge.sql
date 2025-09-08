-- Global AI Knowledge Base
-- Create table to store globally shared knowledge items

CREATE TABLE IF NOT EXISTS public.global_ai_knowledge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  source_url VARCHAR,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_global_ai_knowledge_created_at
  ON public.global_ai_knowledge(created_at);

CREATE INDEX IF NOT EXISTS idx_global_ai_knowledge_title
  ON public.global_ai_knowledge(title);

-- GIN index for array tags filtering
CREATE INDEX IF NOT EXISTS idx_global_ai_knowledge_tags
  ON public.global_ai_knowledge USING GIN(tags);

-- RLS disabled; access control handled at API layer (consistent with other tables)
ALTER TABLE public.global_ai_knowledge DISABLE ROW LEVEL SECURITY;


