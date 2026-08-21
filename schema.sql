-- Rode isto uma vez no SQL Editor do Supabase.

create table if not exists public.cadernos (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  dados      jsonb not null,
  updated_at timestamptz not null default now()
);

-- Coluna antiga (dados_anterior) foi substituída por um histórico completo.
-- Mantida na tabela sem uso pra não descartar snapshot de quem já tinha —
-- o app migra esse valor pra dentro de "historico" sozinho no primeiro
-- carregamento depois do deploy. "if not exists" deixa este script seguro
-- de rodar de novo em bancos que já existiam.
alter table public.cadernos add column if not exists dados_anterior jsonb;

-- Um registro por mês fechado: { mesBase, anoBase, itens, fechadoEm }.
-- Cresce pra sempre — é só nomes/valores/parcelas, não pesa.
alter table public.cadernos add column if not exists historico jsonb not null default '[]'::jsonb;

alter table public.cadernos enable row level security;

-- Cada usuário só enxerga e só mexe na própria linha.
-- Isso é garantido pelo banco, não pelo frontend.
create policy "dono le" on public.cadernos
  for select using (auth.uid() = user_id);

create policy "dono cria" on public.cadernos
  for insert with check (auth.uid() = user_id);

create policy "dono atualiza" on public.cadernos
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "dono apaga" on public.cadernos
  for delete using (auth.uid() = user_id);
