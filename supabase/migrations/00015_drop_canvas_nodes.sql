-- Drop canvas_nodes table and related artifacts (legacy removal)

-- Drop trigger if exists
DROP TRIGGER IF EXISTS set_canvas_nodes_updated_at ON public.canvas_nodes;

-- Drop indexes if exist (safe to ignore if already dropped with table)
DROP INDEX IF EXISTS idx_canvas_nodes_canvas;
DROP INDEX IF EXISTS idx_canvas_nodes_type;
DROP INDEX IF EXISTS idx_canvas_nodes_created_by;

-- Finally drop the table
DROP TABLE IF EXISTS public.canvas_nodes;


