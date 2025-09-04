-- Disable RLS for canvas_todos table and remove policies
-- We handle permissions in API routes instead of database level

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view canvas todos they have access to" ON canvas_todos;
DROP POLICY IF EXISTS "Users can insert canvas todos for canvases they have access to" ON canvas_todos;
DROP POLICY IF EXISTS "Users can update canvas todos for canvases they have access to" ON canvas_todos;
DROP POLICY IF EXISTS "Users can delete canvas todos for canvases they have access to" ON canvas_todos;

-- Disable RLS (Row Level Security)
ALTER TABLE canvas_todos DISABLE ROW LEVEL SECURITY;

-- Add comment explaining the change
COMMENT ON TABLE canvas_todos IS 'Canvas todos table with API-level permission handling instead of RLS';

