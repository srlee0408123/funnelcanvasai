-- Add CASCADE delete constraints to ensure data integrity
-- When workspaces are deleted, all related canvases and their data should be deleted
-- When canvases are deleted, all related knowledge data should be deleted

-- 1. Workspace related CASCADE settings
-- Update workspaces table to CASCADE delete when profile is deleted
ALTER TABLE public.workspaces 
DROP CONSTRAINT IF EXISTS workspaces_owner_id_fkey,
ADD CONSTRAINT workspaces_owner_id_fkey 
FOREIGN KEY (owner_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Workspace members CASCADE settings
-- Delete workspace members when workspace is deleted
ALTER TABLE public.workspace_members 
DROP CONSTRAINT IF EXISTS workspace_members_workspace_id_fkey,
ADD CONSTRAINT workspace_members_workspace_id_fkey 
FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Delete workspace members when user profile is deleted
ALTER TABLE public.workspace_members 
DROP CONSTRAINT IF EXISTS workspace_members_user_id_fkey,
ADD CONSTRAINT workspace_members_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 3. Canvas related CASCADE settings
-- Delete canvases when workspace is deleted
ALTER TABLE public.canvases 
DROP CONSTRAINT IF EXISTS canvases_workspace_id_fkey,
ADD CONSTRAINT canvases_workspace_id_fkey 
FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Set created_by to NULL when profile is deleted (preserve canvas)
ALTER TABLE public.canvases 
DROP CONSTRAINT IF EXISTS canvases_created_by_fkey,
ADD CONSTRAINT canvases_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Canvas states CASCADE settings
-- Delete canvas states when canvas is deleted
ALTER TABLE public.canvas_states 
DROP CONSTRAINT IF EXISTS canvas_states_canvas_id_fkey,
ADD CONSTRAINT canvas_states_canvas_id_fkey 
FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;

-- Delete canvas states when user profile is deleted
ALTER TABLE public.canvas_states 
DROP CONSTRAINT IF EXISTS canvas_states_user_id_fkey,
ADD CONSTRAINT canvas_states_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 5. Canvas nodes CASCADE settings
-- Delete canvas nodes when canvas is deleted
ALTER TABLE public.canvas_nodes 
DROP CONSTRAINT IF EXISTS canvas_nodes_canvas_id_fkey,
ADD CONSTRAINT canvas_nodes_canvas_id_fkey 
FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;

-- Set created_by to NULL when profile is deleted (preserve node)
ALTER TABLE public.canvas_nodes 
DROP CONSTRAINT IF EXISTS canvas_nodes_created_by_fkey,
ADD CONSTRAINT canvas_nodes_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 6. Canvas edges CASCADE settings
-- Delete canvas edges when canvas is deleted
ALTER TABLE public.canvas_edges 
DROP CONSTRAINT IF EXISTS canvas_edges_canvas_id_fkey,
ADD CONSTRAINT canvas_edges_canvas_id_fkey 
FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;

-- Set created_by to NULL when profile is deleted (preserve edge)
ALTER TABLE public.canvas_edges 
DROP CONSTRAINT IF EXISTS canvas_edges_created_by_fkey,
ADD CONSTRAINT canvas_edges_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 7. Canvas todos CASCADE settings
-- Delete canvas todos when canvas is deleted
ALTER TABLE public.canvas_todos 
DROP CONSTRAINT IF EXISTS canvas_todos_canvas_id_fkey,
ADD CONSTRAINT canvas_todos_canvas_id_fkey 
FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;

-- 8. Canvas shares CASCADE settings
-- Delete canvas shares when canvas is deleted
ALTER TABLE public.canvas_shares 
DROP CONSTRAINT IF EXISTS canvas_shares_canvas_id_fkey,
ADD CONSTRAINT canvas_shares_canvas_id_fkey 
FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;

-- Delete canvas shares when user profile is deleted
ALTER TABLE public.canvas_shares 
DROP CONSTRAINT IF EXISTS canvas_shares_user_id_fkey,
ADD CONSTRAINT canvas_shares_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Set invited_by to NULL when inviter profile is deleted (preserve share record)
ALTER TABLE public.canvas_shares 
DROP CONSTRAINT IF EXISTS canvas_shares_invited_by_fkey,
ADD CONSTRAINT canvas_shares_invited_by_fkey 
FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 9. Chat messages CASCADE settings
-- Delete chat messages when canvas is deleted
ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_canvas_id_fkey,
ADD CONSTRAINT chat_messages_canvas_id_fkey 
FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;

-- Delete chat messages when user profile is deleted
ALTER TABLE public.chat_messages 
DROP CONSTRAINT IF EXISTS chat_messages_user_id_fkey,
ADD CONSTRAINT chat_messages_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 10. Text memos CASCADE settings
-- Delete text memos when canvas is deleted
ALTER TABLE public.text_memos 
DROP CONSTRAINT IF EXISTS text_memos_canvas_id_fkey,
ADD CONSTRAINT text_memos_canvas_id_fkey 
FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;

-- 11. Canvas knowledge CASCADE settings
-- Delete canvas knowledge when canvas is deleted
ALTER TABLE public.canvas_knowledge 
DROP CONSTRAINT IF EXISTS canvas_knowledge_canvas_id_fkey,
ADD CONSTRAINT canvas_knowledge_canvas_id_fkey 
FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;

-- 12. Knowledge chunks CASCADE settings
-- Delete knowledge chunks when canvas is deleted
ALTER TABLE public.knowledge_chunks 
DROP CONSTRAINT IF EXISTS knowledge_chunks_canvas_id_fkey,
ADD CONSTRAINT knowledge_chunks_canvas_id_fkey 
FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE;

-- Delete knowledge chunks when knowledge is deleted
ALTER TABLE public.knowledge_chunks 
DROP CONSTRAINT IF EXISTS knowledge_chunks_knowledge_id_fkey,
ADD CONSTRAINT knowledge_chunks_knowledge_id_fkey 
FOREIGN KEY (knowledge_id) REFERENCES public.canvas_knowledge(id) ON DELETE CASCADE;

-- 13. Funnel templates CASCADE settings
-- Set created_by to NULL when profile is deleted (preserve template for public use)
ALTER TABLE public.funnel_templates 
DROP CONSTRAINT IF EXISTS funnel_templates_created_by_fkey,
ADD CONSTRAINT funnel_templates_created_by_fkey 
FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Add comment for documentation
COMMENT ON TABLE public.workspaces IS 'Workspaces table with CASCADE delete - when deleted, all related canvases and data are removed';
COMMENT ON TABLE public.canvases IS 'Canvases table with CASCADE delete - when deleted, all related nodes, edges, knowledge, and other data are removed';
COMMENT ON TABLE public.canvas_knowledge IS 'Canvas knowledge table with CASCADE delete - when deleted, all related chunks are removed';
