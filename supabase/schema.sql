-- Palavra Viva: tabela de mensagens com isolamento por usuário.
-- Execute este arquivo no SQL Editor do projeto Supabase Palavra Viva.

create table if not exists public.sermons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  theme text not null default 'Sem categoria',
  date text not null,
  status text not null default 'Rascunho',
  content text not null default '',
  created_at timestamptz not null default now()
);

alter table public.sermons enable row level security;

drop policy if exists "Usuários podem ver suas próprias mensagens" on public.sermons;
create policy "Usuários podem ver suas próprias mensagens"
on public.sermons for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Usuários podem criar suas próprias mensagens" on public.sermons;
create policy "Usuários podem criar suas próprias mensagens"
on public.sermons for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Usuários podem editar suas próprias mensagens" on public.sermons;
create policy "Usuários podem editar suas próprias mensagens"
on public.sermons for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Usuários podem excluir suas próprias mensagens" on public.sermons;
create policy "Usuários podem excluir suas próprias mensagens"
on public.sermons for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update, delete on public.sermons to authenticated;
