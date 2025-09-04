-- Add canvas nodes and edges tables for individual node storage with JSON metadata
-- This migration adds support for storing individual nodes and their connections
-- alongside the existing canvas_states table for comprehensive canvas management

-- Canvas nodes table for storing individual nodes with JSON metadata
CREATE TABLE public.canvas_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL, -- Frontend node ID (e.g., "node_1", "node_2")
    type TEXT NOT NULL, -- Node type (e.g., "landing", "form", "email", etc.)
    position JSONB NOT NULL, -- { x: number, y: number }
    data JSONB NOT NULL, -- Node data (title, subtitle, icon, color, etc.)
    metadata JSONB DEFAULT '{}', -- Additional metadata for the node
    created_by TEXT NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    
    -- Ensure unique node_id per canvas
    UNIQUE(canvas_id, node_id)
);

-- Canvas edges table for storing connections between nodes
CREATE TABLE public.canvas_edges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
    edge_id TEXT NOT NULL, -- Frontend edge ID
    source_node_id TEXT NOT NULL, -- Source node ID
    target_node_id TEXT NOT NULL, -- Target node ID
    type TEXT DEFAULT 'default', -- Edge type
    data JSONB DEFAULT '{}', -- Edge data (label, style, etc.)
    metadata JSONB DEFAULT '{}', -- Additional metadata for the edge
    created_by TEXT NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    
    -- Ensure unique edge_id per canvas
    UNIQUE(canvas_id, edge_id)
);

-- Create indexes for better performance
CREATE INDEX idx_canvas_nodes_canvas ON public.canvas_nodes(canvas_id);
CREATE INDEX idx_canvas_nodes_type ON public.canvas_nodes(type);
CREATE INDEX idx_canvas_nodes_created_by ON public.canvas_nodes(created_by);
CREATE INDEX idx_canvas_edges_canvas ON public.canvas_edges(canvas_id);
CREATE INDEX idx_canvas_edges_source ON public.canvas_edges(source_node_id);
CREATE INDEX idx_canvas_edges_target ON public.canvas_edges(target_node_id);

-- Disable Row Level Security (consistent with other tables)
ALTER TABLE public.canvas_nodes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_edges DISABLE ROW LEVEL SECURITY;

-- Create triggers for updated_at using existing function
CREATE TRIGGER set_canvas_nodes_updated_at BEFORE UPDATE ON public.canvas_nodes
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_canvas_edges_updated_at BEFORE UPDATE ON public.canvas_edges
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Add foreign key constraints to ensure node references exist
-- Note: These constraints are commented out initially to avoid issues with existing data
-- Uncomment after ensuring data consistency

-- ALTER TABLE public.canvas_edges 
-- ADD CONSTRAINT fk_canvas_edges_source 
-- FOREIGN KEY (canvas_id, source_node_id) 
-- REFERENCES public.canvas_nodes(canvas_id, node_id) 
-- ON DELETE CASCADE;

-- ALTER TABLE public.canvas_edges 
-- ADD CONSTRAINT fk_canvas_edges_target 
-- FOREIGN KEY (canvas_id, target_node_id) 
-- REFERENCES public.canvas_nodes(canvas_id, node_id) 
-- ON DELETE CASCADE;
