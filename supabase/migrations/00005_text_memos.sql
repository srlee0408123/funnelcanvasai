-- Text memos for canvas annotations
create table if not exists public.text_memos (
  id uuid primary key default gen_random_uuid(),
  canvas_id uuid not null references public.canvases(id) on delete cascade,
  content text not null,
  position jsonb not null,
  size jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists text_memos_canvas_id_idx on public.text_memos(canvas_id);


