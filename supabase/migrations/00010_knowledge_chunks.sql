-- Create table for knowledge chunks with vector embeddings for RAG
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
  knowledge_id UUID NOT NULL REFERENCES public.canvas_knowledge(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL,
  text TEXT NOT NULL,
  tokens INTEGER,
  start_char INTEGER,
  end_char INTEGER,
  start_ts DOUBLE PRECISION,
  end_ts DOUBLE PRECISION,
  embedding vector(1536),
  chunk_hash TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW())
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_knowledge_chunks_knowledge_seq
  ON public.knowledge_chunks(knowledge_id, seq);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_canvas
  ON public.knowledge_chunks(canvas_id);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_hash
  ON public.knowledge_chunks(chunk_hash);

-- Vector index for fast ANN search
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding
  ON public.knowledge_chunks USING ivfflat (embedding vector_l2_ops) WITH (lists = 100);


