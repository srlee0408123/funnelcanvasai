-- Remove unused columns from knowledge_chunks table for RAG optimization
-- Keep only essential columns: id, canvas_id, knowledge_id, seq, text, embedding, created_at

-- Drop indexes on columns that will be removed
DROP INDEX IF EXISTS idx_knowledge_chunks_hash;

-- Remove unused columns
ALTER TABLE public.knowledge_chunks DROP COLUMN IF EXISTS tokens;
ALTER TABLE public.knowledge_chunks DROP COLUMN IF EXISTS start_char;
ALTER TABLE public.knowledge_chunks DROP COLUMN IF EXISTS end_char;
ALTER TABLE public.knowledge_chunks DROP COLUMN IF EXISTS start_ts;
ALTER TABLE public.knowledge_chunks DROP COLUMN IF EXISTS end_ts;
ALTER TABLE public.knowledge_chunks DROP COLUMN IF EXISTS chunk_hash;
ALTER TABLE public.knowledge_chunks DROP COLUMN IF EXISTS metadata;

-- Verify final table structure
-- Expected columns: id, canvas_id, knowledge_id, seq, text, embedding, created_at
