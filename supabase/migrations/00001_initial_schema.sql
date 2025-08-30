-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Workspaces
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Workspace members
CREATE TABLE public.workspace_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    UNIQUE(workspace_id, user_id)
);

-- Canvases
CREATE TABLE public.canvases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Canvas states
CREATE TABLE public.canvas_states (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
    state JSONB NOT NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Canvas knowledge
CREATE TABLE public.canvas_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('pdf', 'youtube', 'url', 'text')),
    title TEXT NOT NULL,
    content TEXT,
    metadata JSONB,
    embedding vector(1536),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Funnel templates
CREATE TABLE public.funnel_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    template_data JSONB NOT NULL,
    is_public BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Chat messages
CREATE TABLE public.chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Canvas todos
CREATE TABLE public.canvas_todos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    canvas_id UUID NOT NULL REFERENCES public.canvases(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.canvas_todos ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Workspaces policies
CREATE POLICY "Users can view workspaces they are members of" ON public.workspaces
    FOR SELECT USING (
        auth.uid() IN (
            SELECT user_id FROM public.workspace_members
            WHERE workspace_id = id
        )
    );

CREATE POLICY "Workspace owners can update their workspaces" ON public.workspaces
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Users can create workspaces" ON public.workspaces
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Canvas policies
CREATE POLICY "Public canvases are viewable by everyone" ON public.canvases
    FOR SELECT USING (
        is_public = true OR
        auth.uid() IN (
            SELECT user_id FROM public.workspace_members
            WHERE workspace_id = canvases.workspace_id
        )
    );

CREATE POLICY "Workspace members can create canvases" ON public.canvases
    FOR INSERT WITH CHECK (
        auth.uid() IN (
            SELECT user_id FROM public.workspace_members
            WHERE workspace_id = canvases.workspace_id
        )
    );

CREATE POLICY "Canvas creators can update their canvases" ON public.canvases
    FOR UPDATE USING (
        auth.uid() = created_by OR
        auth.uid() IN (
            SELECT user_id FROM public.workspace_members
            WHERE workspace_id = canvases.workspace_id
            AND role IN ('owner', 'admin')
        )
    );

-- Functions and Triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, avatar_url)
    VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_canvases_updated_at BEFORE UPDATE ON public.canvases
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_canvas_knowledge_updated_at BEFORE UPDATE ON public.canvas_knowledge
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funnel_templates_updated_at BEFORE UPDATE ON public.funnel_templates
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_canvas_todos_updated_at BEFORE UPDATE ON public.canvas_todos
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();