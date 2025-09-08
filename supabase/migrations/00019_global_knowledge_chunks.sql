-- Global knowledge chunks for vector search (RAG)

CREATE TABLE IF NOT EXISTS public.global_knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_id UUID NOT NULL REFERENCES public.global_ai_knowledge(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  text TEXT NOT NULL,
  tokens INTEGER,
  embedding vector(1536),
  chunk_hash TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_global_kc_knowledge_seq
  ON public.global_knowledge_chunks(knowledge_id, seq);

CREATE INDEX IF NOT EXISTS idx_global_kc_knowledge
  ON public.global_knowledge_chunks(knowledge_id);

CREATE INDEX IF NOT EXISTS idx_global_kc_hash
  ON public.global_knowledge_chunks(chunk_hash);

-- Vector index for ANN search
CREATE INDEX IF NOT EXISTS idx_global_kc_embedding
  ON public.global_knowledge_chunks USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);

-- RPC: match global knowledge chunks by vector similarity
CREATE OR REPLACE FUNCTION public.match_global_knowledge_chunks(
  query_embedding vector(1536),
  match_count int DEFAULT 8,
  min_similarity float DEFAULT 0.70
)
RETURNS TABLE (
  id uuid,
  knowledge_id uuid,
  text text,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    kc.id,
    kc.knowledge_id,
    kc.text,
    1 - (kc.embedding <-> query_embedding) AS similarity
  FROM public.global_knowledge_chunks kc
  WHERE kc.embedding IS NOT NULL
  ORDER BY kc.embedding <-> query_embedding
  LIMIT match_count
$$;

-- RLS disabled; API handles access control
ALTER TABLE public.global_knowledge_chunks DISABLE ROW LEVEL SECURITY;


