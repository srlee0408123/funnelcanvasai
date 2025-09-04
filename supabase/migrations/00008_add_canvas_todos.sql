-- Canvas todos for task management
CREATE TABLE IF NOT EXISTS canvas_todos (
  id UUID NOT NULL DEFAULT uuid_generate_v4(),
  canvas_id UUID NOT NULL,
  text TEXT NOT NULL,
  completed BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  CONSTRAINT canvas_todos_pkey PRIMARY KEY (id),
  CONSTRAINT canvas_todos_canvas_id_fkey FOREIGN KEY (canvas_id) REFERENCES public.canvases(id) ON DELETE CASCADE
);

-- Create index for canvas_id for faster queries
CREATE INDEX IF NOT EXISTS canvas_todos_canvas_id_idx ON canvas_todos(canvas_id);

-- Create index for position ordering
CREATE INDEX IF NOT EXISTS canvas_todos_position_idx ON canvas_todos(canvas_id, position);

-- Enable RLS (Row Level Security)
ALTER TABLE canvas_todos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for canvas_todos
-- Users can only access todos for canvases they have access to
CREATE POLICY "Users can view canvas todos they have access to" ON canvas_todos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM canvases c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE c.id = canvas_todos.canvas_id
      AND (
        w.owner_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = w.id
          AND wm.user_id = auth.uid()::text
        )
      )
    )
  );

CREATE POLICY "Users can insert canvas todos for canvases they have access to" ON canvas_todos
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM canvases c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE c.id = canvas_todos.canvas_id
      AND (
        w.owner_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = w.id
          AND wm.user_id = auth.uid()::text
        )
      )
    )
  );

CREATE POLICY "Users can update canvas todos for canvases they have access to" ON canvas_todos
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM canvases c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE c.id = canvas_todos.canvas_id
      AND (
        w.owner_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = w.id
          AND wm.user_id = auth.uid()::text
        )
      )
    )
  );

CREATE POLICY "Users can delete canvas todos for canvases they have access to" ON canvas_todos
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM canvases c
      JOIN workspaces w ON c.workspace_id = w.id
      WHERE c.id = canvas_todos.canvas_id
      AND (
        w.owner_id = auth.uid()::text
        OR EXISTS (
          SELECT 1 FROM workspace_members wm
          WHERE wm.workspace_id = w.id
          AND wm.user_id = auth.uid()::text
        )
      )
    )
  );

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_canvas_todos_updated_at
  BEFORE UPDATE ON canvas_todos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
