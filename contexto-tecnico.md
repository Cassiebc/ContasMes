# Caderno de Contas — contexto técnico

Documento de contexto para retomar o projeto em novas sessões.
Última atualização: 2026-08-24.

## O que é

App de controle de contas fixas e parceladas, com projeção dos próximos meses
e histórico dos meses já fechados. Multiusuário: cada pessoa cria a própria
conta e vê apenas os próprios lançamentos. Dados no servidor, então o mesmo
login mostra a mesma lista no celular e no computador.

Em produção: <https://caderno-auth.vercel.app>

## Onde fica

O repositório Git é a fonte de verdade — não a pasta local, já que o projeto
é trabalhado de máquinas diferentes (casa e trabalho). Antes de começar uma
sessão, clonar/atualizar o repositório e trabalhar a partir dele, em vez de
assumir um caminho fixo.

Fluxo de trabalho: commits vão para `dev`, são testados, e só então `dev` é
mesclada em `main`.

**Dar push em `main` publica em produção.** O projeto na Vercel está ligado ao
repositório no GitHub, então todo push nessa branch dispara um deploy sozinho
(dá pra confirmar pela URL `cadernocontas-git-main-*` nos deploys). Push em
`dev` não publica. `vercel --prod` continua funcionando para publicar à mão,
mas não é necessário.

## Stack

- React 18.3 + Vite 6
- Tailwind CSS 4 (via `@tailwindcss/vite`, sem arquivo de config — é CSS-first)
- `@supabase/supabase-js` 2.47 — auth (e-mail/senha) e persistência
- Vitest 3 para os testes unitários (`npm test`)
- Deploy: Vercel
- PWA: manifest + service worker, instalável no iPhone e no Android

## Estrutura de arquivos

```
index.html          meta tags PWA + script inline que aplica o tema
vercel.json         rewrite SPA + cabeçalhos de segurança (CSP etc.)
vite.config.js
schema-v2.sql       tabelas `meses` e `lancamentos` (modelo atual)
schema.sql          modelo antigo (jsonb), mantido como referência
.env.example        modelo das variáveis (o .env real não é versionado)
src/
  main.jsx          entrypoint, registra o service worker
  App.jsx           estado, efeitos e handlers; orquestra os componentes
  Login.jsx         tela de login / criar conta, com erros traduzidos
  supabase.js       cria o client a partir das env vars
  index.css         @custom-variant dark + reset mínimo
  lib/
    caderno.js      helpers puros (MESES, brl, ativoEm, rotuloMes, fecharMes)
    caderno.test.js testes da regra de negócio
    repositorio.js  todo o acesso ao banco; a tela não conhece SQL
    tema.js         hook useTema (claro/escuro + persistência)
    atualizacao.js  detecta versão nova publicada e recarrega o app
  components/
    AbaMes.jsx          o mês atual (ou projeção calculada)
    AbaMesHistorico.jsx um mês concreto de historico/futuro
    AbaProjecao.jsx     lista de meses + backup (JSON/CSV)
    AbaHistorico.jsx    lista dos meses fechados
    CardTotal.jsx       o quadro do total (compartilhado)
    Secao.jsx           lista de itens; aceita readOnly
    FormConta.jsx       modal de lançar/editar
    ModalFecharMes.jsx  confirmação de fechar
    ModalAbrirMes.jsx   confirmação de abrir
    ModalApagarMes.jsx  confirmação de apagar mês / descartar planejamento
    AlertaIOS.jsx       caixa de confirmação no padrão do iOS
    BotaoTema.jsx       alterna claro/escuro
public/
  manifest.json     standalone, portrait, ícones normais + maskable, screenshots
  sw.js             service worker, cache "caderno-v1", network-first
  icon-*.png        180/192/512 + variantes -maskable
  screenshot-*.png  usadas no prompt de instalação do Android
```

## Banco (Supabase)

Duas tabelas, criadas por `schema-v2.sql`:

```sql
create table public.meses (
  id uuid primary key, user_id uuid, ano int, mes int,   -- mes: 0 = janeiro
  atual boolean not null default false,
  fechado_em timestamptz,
  unique (user_id, ano, mes)
);
create unique index meses_um_atual_por_usuario
  on public.meses (user_id) where atual;

create table public.lancamentos (
  id uuid primary key, mes_id uuid references meses(id) on delete cascade,
  nome text, valor numeric(12,2), tipo text,   -- 'fixo' | 'parcelado'
  paga int, total int,
  constraint parcelas_coerentes check (...)    -- fixo sem parcela; parcelado com paga <= total
);
```

O que o banco garante, e antes dependia do código lembrar:

- **mês não se repete** (`unique (user_id, ano, mes)`) — a duplicata de
  "agosto" que aparecia ao restaurar backup por cima do histórico;
- **um único mês atual** por pessoa (índice único parcial);
- **parcela coerente** — não existe "5 de 3", nem fixo com número de parcela;
- **valor sempre positivo**, nome não vazio.

RLS ligado nas duas. Em `meses` a política é `auth.uid() = user_id`; em
`lancamentos`, o dono é quem for dono do mês (via `exists`).

Usa a chave **publishable** (`sb_publishable_...`): pública por design, vai
embutida no bundle, e o RLS é quem protege. Nunca a `secret`/`service_role`.

### A linha do tempo

Não existem listas separadas de passado/futuro. Existem meses, ordenados por
(ano, mes), e **um** deles carrega `atual = true`. O resto sai da comparação:
antes do atual é fechado, depois é planejado. Assim não dá pra um mês fechado
aparecer depois do atual, nem a ordem sair errada.

`abrir mês` virou uma linha: muda qual mês tem `atual`. Nada é movido de lugar.

### Migração do formato antigo

A tabela `cadernos` (um jsonb por pessoa, com `dados`/`historico`/`futuro`)
continua no banco, intacta, como rede de segurança. `repositorio.js` migra
sozinho na primeira abertura, quando ainda não há meses no formato novo:
meses repetidos viram um só, com os lançamentos dos dois juntos.

A coluna `lancamentos.origem_id` guarda de qual item antigo veio cada
lançamento, pra migração poder rodar de novo sem duplicar. Pode sair depois
que a migração estiver conferida.

## Regras de negócio

- **Fixos**: entram todo mês, sem data de fim.
- **Parcelado**: informa-se "já paguei X de Y". A parcela X é a do mês atual,
  então faltam `Y - X` meses depois deste.
- O mês **nunca vira sozinho** quando o calendário muda. Só pelos botões
  "fechar mês"/"abrir mês" — porque virar de mês significa dar mais uma
  parcela como paga em tudo, e isso é decisão do usuário, não do relógio.
- Cada usuário começa com caderno vazio, ancorado no mês em que criou a conta
  (lido do relógio do aparelho, em `novoCaderno()` dentro de `lib/caderno.js`).

### Como a tela lê a linha do tempo

`App.jsx` trabalha com um `offset` relativo ao mês atual:

| offset | de onde vem | editável? |
| --- | --- | --- |
| `< 0` | `historico[offset + historico.length]` | sim, só naquele mês |
| `0` | `dados` — o mês atual | sim |
| `1..futuro.length` | `futuro[offset - 1]` | sim, só naquele mês |
| `> futuro.length` | calculado por `ativoEm()` a partir do último mês que existe | sim, mas grava no mês atual |

`historico` e `futuro` não são guardados: `repositorio.carregar()` os deriva
comparando cada mês com o que está marcado como atual.

As mesmas setas ← → percorrem a linha inteira. Toda alteração vai pro banco e
o caderno é relido — a tela é sempre reflexo do banco, nunca uma cópia que
foi se afastando dele.

**Fechar mês**: marca `fechado_em` no mês atual e passa `atual` pro seguinte.
Se o mês seguinte já existe (foi planejado), ele é adotado com o que tiver
dentro; se não, é criado com `fecharMes()` — cada parcela avança uma casa e
as que acabaram somem.

**Abrir mês**: só muda qual mês tem `atual = true`. Não move nada; o resto se
reorganiza porque "fechado" e "planejado" saem da comparação de datas.

**Mês à frente sem lançamento não é planejamento.** `ehPlanejamentoVazio()`
marca esses, e `carregar()` os apaga. Guardar um deles zeraria a projeção
daquele mês e, num fechamento, apagaria as contas fixas — foi bug real duas
vezes. Mês fechado vazio fica: "nesse mês não tive contas" é informação.

## Visual

Segue o Human Interface Guidelines da Apple, na variante sóbria: a estrutura
e os padrões de interação são os do iOS, sem cor de marca. O destaque é o
próprio contraste — preto no claro, branco no escuro — e cor fica reservada
pra quando significa alguma coisa (vermelho em apagar).

- **Cores** são tokens semânticos em `index.css`, nomeados pelo papel
  (`--fundo`, `--cartao`, `--rotulo`, `--separador`, `--preenchido`,
  `--destaque`). O tema escuro é só uma troca de valores em `.dark`; nenhum
  componente conhece cor literal.
- **Tipografia** é a do sistema (SF Pro no iPhone), na escala do HIG: 34px no
  título do mês, 17px no corpo, 13px em rótulos e apoio.
- **Listas** são o *inset grouped*: cartão com cantos, separador começando
  alinhado ao texto (classe `.lista-ios`).
- **Confirmações** usam `AlertaIOS` — caixa central, ação em negrito,
  destrutiva em vermelho. O formulário é um *sheet* que sobe, com alça e
  Cancelar/Salvar no topo.
- Toda área de toque tem no mínimo 44&nbsp;pt, e a barra inferior respeita
  `env(safe-area-inset-bottom)`.

A identidade anterior (serif Georgia, bege de papel, cantos retos) saiu nessa
troca. Se um dia voltar atrás, o que muda é só o bloco de tokens e as classes
dos componentes — a lógica não conhece nada disso.

## Tema claro/escuro

## Tema claro/escuro

`lib/tema.js` lê a preferência salva em `localStorage` (ou a do sistema),
alterna a classe `dark` no `<html>` e atualiza o `theme-color` do PWA
(`#F2F2F7` no claro, `#000000` no escuro).

Dois detalhes que quebram fácil se mexerem sem saber:

1. Tailwind 4 aqui não tem arquivo de config, então a variante `dark` por
   classe precisa ser declarada à mão em `index.css`
   (`@custom-variant dark (&:where(.dark, .dark *))`).
2. O `index.html` tem um script inline que aplica a classe antes do primeiro
   paint (senão a tela pisca branca antes de escurecer). Esse script é
   liberado na CSP **por hash** — mexer nele sem recalcular o hash em
   `vercel.json` faz o navegador bloqueá-lo silenciosamente.

## Segurança

Auditado em 2026-08-21 contra o app em produção:

- RLS bloqueia leitura e escrita entre usuários (`[]` e HTTP 403); nenhuma
  outra tabela exposta; schema não vaza.
- A chave no bundle é a publishable, não a secreta.
- Sem sinks de XSS no código (React escapa por padrão; nenhum
  `dangerouslySetInnerHTML`).
- `vercel.json` manda CSP, `X-Frame-Options`, `X-Content-Type-Options`,
  `Referrer-Policy` e `Permissions-Policy`. A CSP restringe `connect-src` ao
  host do Supabase e usa hash no script inline em vez de `unsafe-inline`.
  `style-src` precisa de `'unsafe-inline'` porque o React aplica os
  `style={{...}}` como atributo.

Pendências conhecidas (decisão do usuário, não bugs):

- Cadastro público está aberto — qualquer um com a URL cria conta e consome a
  cota gratuita.
- Senha mínima do Supabase é 6 caracteres no servidor (o formulário exige 8).

## Offline

O service worker mantém a **interface** funcionando sem internet, mas os dados
vêm do servidor. Sem conexão dá para abrir o app e ver a última tela
carregada, mas não dá para salvar — e um aviso aparece dizendo isso.

## Atualização depois de um deploy

`lib/atualizacao.js` guarda qual bundle está rodando e, quando o app volta pro
foco, compara com o que o `index.html` do servidor está entregando. Se são
diferentes, saiu versão nova: limpa os caches e recarrega.

Isso existe porque o app instalado na tela inicial **não recarrega sozinho** —
ele retoma com o JavaScript que baixou da primeira vez e pode ficar dias
assim. E não dá pra resolver pelo service worker: o `sw.js` é byte a byte o
mesmo arquivo em todo deploy, então o navegador nunca o considera novo e o
`skipWaiting()` nunca roda de novo.

Se um dia mudar a estratégia do `sw.js`, lembre que o arquivo precisa mudar de
conteúdo para o navegador sequer perceber.

## Deploy

`vercel --prod`. As duas variáveis (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) precisam estar cadastradas em
Settings → Environment Variables no painel da Vercel, e o build precisa rodar
**depois** de cadastradas.

Ao mudar de projeto Supabase, lembre de atualizar o host no `connect-src` da
CSP em `vercel.json` — senão o app carrega mas nenhuma requisição passa.

## Instalação no celular

- **iPhone**: abrir a URL no Safari (Chrome no iOS não oferece a opção) →
  compartilhar → "Adicionar à Tela de Início".
- **Android**: Chrome mostra prompt de instalação ou menu ⋮ → "Instalar app".

## Como testar

`npm test` (Vitest) cobre só as funções puras de `lib/caderno.js` — cálculo de
parcela, virada de mês, rótulo do mês. É rápido e vale rodar sempre, mas
**nenhum dos bugs de consistência foi pego por ele**.

O que pegou foi teste de ponta a ponta: Playwright dirigindo o app real contra
o Supabase, conferindo o banco a cada passo. Vale reproduzir o fluxo relatado
antes de supor a causa — várias vezes a suspeita inicial estava errada, e o
que parecia um bug era efeito colateral de uma correção anterior.

Cenários que já quebraram, e por isso valem revisitar ao mexer na linha do
tempo:

- fechar mês com um planejamento vazio à frente → as contas fixas sumiam;
- lançar parcela num mês e depois abrir um mês anterior → a parcela sumia da
  projeção dos meses seguintes;
- restaurar backup por cima de um caderno diferente → o mês duplicava;
- apagar o último lançamento de um mês planejado → aquele mês zerava;
- migração rodando duas vezes ao mesmo tempo (o efeito roda duas vezes em
  desenvolvimento, ou o app está aberto em duas abas).

## Observação sobre continuidade

Claude não guarda memória entre sessões de forma garantida. Este documento é
o que permite retomar o projeto sem reconstruir o contexto do zero. Vale
atualizá-lo sempre que houver mudança estrutural — e manter dentro do próprio
repositório, já que é ele (não uma pasta local) a referência de onde o
projeto está.
