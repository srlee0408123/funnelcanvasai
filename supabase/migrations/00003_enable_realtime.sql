-- Enable Realtime for tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspaces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.workspace_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.canvases;
ALTER PUBLICATION supabase_realtime ADD TABLE public.canvas_states;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.canvas_knowledge;

-- Note: Run this in Supabase SQL Editor or Dashboard
-- This enables realtime subscriptions for the specified tables