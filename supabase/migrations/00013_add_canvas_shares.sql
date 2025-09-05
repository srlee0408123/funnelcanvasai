-- Create canvas_shares table for per-canvas sharing
CREATE TABLE public.canvas_shares (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('editor', 'viewer')),
    invited_by TEXT REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    UNIQUE(canvas_id, user_id)
);

-- Helpful composite index for lookups
CREATE INDEX idx_canvas_shares_canvas_user ON public.canvas_shares(canvas_id, user_id);

-- RLS is handled at the application layer via service role
ALTER TABLE public.canvas_shares DISABLE ROW LEVEL SECURITY;

