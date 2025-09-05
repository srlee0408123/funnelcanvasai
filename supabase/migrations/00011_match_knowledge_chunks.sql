-- SQL function to match knowledge chunks by embedding similarity for a canvas
-- Requires pgvector extension and knowledge_chunks table (00010 migration)

CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  canvas_id uuid,
  query_embedding vector(1536),
  match_count int DEFAULT 12,
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
  FROM public.knowledge_chunks kc
  WHERE kc.canvas_id = match_knowledge_chunks.canvas_id
    AND kc.embedding IS NOT NULL
  ORDER BY kc.embedding <-> query_embedding
  LIMIT match_count
$$;

-- Optional: helper view for debugging
-- CREATE OR REPLACE VIEW public.v_knowledge_chunk_stats AS
--   SELECT canvas_id, COUNT(*) AS chunks, COUNT(embedding) AS embedded
--   FROM public.knowledge_chunks
--   GROUP BY canvas_id;


