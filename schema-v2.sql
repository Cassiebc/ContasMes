-- Caderno de Contas — modelo relacional (v2)
--
-- Rode isto UMA VEZ no SQL Editor do Supabase. É aditivo: cria tabelas novas
-- e não toca na tabela `cadernos`, que continua guardando os dados antigos
-- até a migração ser conferida.
--
-- A ideia central é tirar do código as regras que ele vinha esquecendo. No
-- modelo jsonb, nada impedia dois "agosto" ou um mês planejado vazio — só o
-- código, que é justamente onde os bugs moravam. Aqui o banco recusa.

-- Um registro por mês do caderno de cada pessoa.
create table if not exists public.meses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  ano        int  not null check (ano between 2000 and 2200),
  mes        int  not null check (mes between 0 and 11),   -- 0 = janeiro
  atual      boolean not null default false,
  fechado_em timestamptz,

  -- Impede o mesmo mês existir duas vezes: era a duplicata de "agosto"
  -- que aparecia depois de restaurar um backup por cima do histórico.
  unique (user_id, ano, mes)
);

-- Só pode haver um mês atual por pessoa. Sem isso, um "abrir mês" que
-- falhasse no meio poderia deixar dois.
create unique index if not exists meses_um_atual_por_usuario
  on public.meses (user_id) where atual;

create index if not exists meses_ordem
  on public.meses (user_id, ano, mes);

-- Os lançamentos de cada mês. O mês em si não guarda valor nenhum: o total
-- é sempre a soma do que está aqui, então não existe "total desatualizado".
create table if not exists public.lancamentos (
  id     uuid primary key default gen_random_uuid(),
  mes_id uuid not null references public.meses(id) on delete cascade,
  nome   text not null check (length(btrim(nome)) > 0),
  valor  numeric(12,2) not null check (valor > 0),
  tipo   text not null check (tipo in ('fixo', 'parcelado')),
  paga   int check (paga is null or paga >= 1),
  total  int check (total is null or total >= 1),

  -- Fixo não tem parcela; parcelado tem as duas, e nunca "5 de 3".
  constraint parcelas_coerentes check (
    (tipo = 'fixo'      and paga is null and total is null) or
    (tipo = 'parcelado' and paga is not null and total is not null and paga <= total)
  )
);

create index if not exists lancamentos_por_mes
  on public.lancamentos (mes_id);

alter table public.meses       enable row level security;
alter table public.lancamentos enable row level security;

-- `create policy` não aceita "if not exists", então cada uma é derrubada
-- antes de ser criada — assim dá pra rodar este arquivo de novo sem erro.
drop policy if exists "dono le meses"        on public.meses;
drop policy if exists "dono cria meses"      on public.meses;
drop policy if exists "dono atualiza meses"  on public.meses;
drop policy if exists "dono apaga meses"     on public.meses;

-- meses: cada pessoa só enxerga e só mexe nos próprios.
create policy "dono le meses" on public.meses
  for select using (auth.uid() = user_id);
create policy "dono cria meses" on public.meses
  for insert with check (auth.uid() = user_id);
create policy "dono atualiza meses" on public.meses
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "dono apaga meses" on public.meses
  for delete using (auth.uid() = user_id);

drop policy if exists "dono le lancamentos"       on public.lancamentos;
drop policy if exists "dono cria lancamentos"     on public.lancamentos;
drop policy if exists "dono atualiza lancamentos" on public.lancamentos;
drop policy if exists "dono apaga lancamentos"    on public.lancamentos;

-- lancamentos: o dono é quem for dono do mês a que ele pertence.
create policy "dono le lancamentos" on public.lancamentos
  for select using (exists (
    select 1 from public.meses m where m.id = lancamentos.mes_id and m.user_id = auth.uid()));
create policy "dono cria lancamentos" on public.lancamentos
  for insert with check (exists (
    select 1 from public.meses m where m.id = lancamentos.mes_id and m.user_id = auth.uid()));
create policy "dono atualiza lancamentos" on public.lancamentos
  for update using (exists (
    select 1 from public.meses m where m.id = lancamentos.mes_id and m.user_id = auth.uid()))
  with check (exists (
    select 1 from public.meses m where m.id = lancamentos.mes_id and m.user_id = auth.uid()));
create policy "dono apaga lancamentos" on public.lancamentos
  for delete using (exists (
    select 1 from public.meses m where m.id = lancamentos.mes_id and m.user_id = auth.uid()));

-- Guarda de qual item do formato antigo veio cada lançamento. Serve pra
-- migração poder rodar de novo sem duplicar nada; pode sair depois que a
-- migração estiver conferida.
alter table public.lancamentos add column if not exists origem_id text;
create unique index if not exists lancamentos_origem
  on public.lancamentos (mes_id, origem_id) where origem_id is not null;
