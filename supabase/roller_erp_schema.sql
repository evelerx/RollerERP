create table if not exists public.erp_state (
  id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.erp_state enable row level security;

create policy "Allow anon read erp state"
on public.erp_state
for select
to anon
using (true);

create policy "Allow anon write erp state"
on public.erp_state
for insert
to anon
with check (true);

create policy "Allow anon update erp state"
on public.erp_state
for update
to anon
using (true)
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'erp_state'
  ) then
    alter publication supabase_realtime add table public.erp_state;
  end if;
end $$;
