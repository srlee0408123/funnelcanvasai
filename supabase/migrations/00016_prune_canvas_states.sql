-- Enable pg_cron extension (Supabase: installed in schema "extensions")
create extension if not exists pg_cron with schema extensions;

-- RPC: return ids to delete for a canvas beyond keep count
create or replace function public.get_canvas_state_ids_to_delete(
  p_canvas_id uuid,
  p_keep_count integer
)
returns table (id uuid)
language sql
stable
as $$
  select id
  from (
    select cs.id,
           row_number() over (partition by cs.canvas_id order by cs.created_at desc) as rn
    from public.canvas_states cs
    where cs.canvas_id = p_canvas_id
  ) ranked
  where ranked.rn > p_keep_count;
$$;

-- Prune function: keep latest N per canvas, only for canvases inactive for given interval
create or replace function public.prune_canvas_states_for_inactive_canvases(
  p_keep_count integer default 30,
  p_inactive_interval interval default interval '30 minutes'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer := 0;
begin
  with inactive as (
    select canvas_id
    from public.canvas_states
    group by canvas_id
    having max(created_at) < now() - p_inactive_interval
  ),
  to_delete as (
    select id
    from (
      select cs.id,
             row_number() over (partition by cs.canvas_id order by cs.created_at desc) as rn
      from public.canvas_states cs
      where cs.canvas_id in (select canvas_id from inactive)
    ) ranked
    where ranked.rn > p_keep_count
  )
  delete from public.canvas_states cs
  using to_delete td
  where cs.id = td.id;

  get diagnostics v_deleted = row_count;
  return coalesce(v_deleted, 0);
end;
$$;

-- Schedule: run every 10 minutes
select cron.schedule(
  'prune_inactive_canvas_states',
  '*/10 * * * *',
  $$select public.prune_canvas_states_for_inactive_canvases(30, interval '30 minutes');$$
);

-- Grants (optional; pg_cron executes as postgres)
grant execute on function public.get_canvas_state_ids_to_delete(uuid, integer) to anon, authenticated, service_role;
grant execute on function public.prune_canvas_states_for_inactive_canvases(integer, interval) to anon, authenticated, service_role;


