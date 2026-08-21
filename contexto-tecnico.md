# Caderno de Contas — contexto técnico

Documento de contexto para retomar o projeto em novas sessões.
Última atualização: 2026-08-21.

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
schema.sql          script para rodar no SQL Editor do Supabase
.env.example        modelo das variáveis (o .env real não é versionado)
src/
  main.jsx          entrypoint, registra o service worker
  App.jsx           estado, efeitos e handlers; orquestra os componentes
  Login.jsx         tela de login / criar conta, com erros traduzidos
  supabase.js       cria o client a partir das env vars
  index.css         @custom-variant dark + reset mínimo
  lib/
    caderno.js      helpers puros (MESES, brl, ativoEm, rotuloMes, fecharMes)
    caderno.test.js 15 testes da regra de negócio
    tema.js         hook useTema (claro/escuro + persistência)
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
    BotaoTema.jsx       alterna claro/escuro
public/
  manifest.json     standalone, portrait, ícones normais + maskable, screenshots
  sw.js             service worker, cache "caderno-v1", network-first
  icon-*.png        180/192/512 + variantes -maskable
  screenshot-*.png  usadas no prompt de instalação do Android
```

## Banco (Supabase)

Uma única tabela, uma linha por usuário:

```sql
create table public.cadernos (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  dados          jsonb not null,          -- o mês ATUAL
  historico      jsonb not null default '[]',  -- meses já fechados
  futuro         jsonb not null default '[]',  -- meses planejados à frente
  dados_anterior jsonb,                   -- legado, ver abaixo
  updated_at     timestamptz not null default now()
);
```

RLS ligado, com 4 políticas (select / insert / update / delete), todas
`auth.uid() = user_id`. O isolamento entre usuários é garantido **no banco**,
não no frontend — auditado em 2026-08-21 (leitura e escrita cross-user
retornam vazio/403).

Usa a chave **publishable** (`sb_publishable_...`, o formato novo do que era
`anon`): pública por design, vai embutida no bundle, e o RLS é quem protege.
Nunca a `secret`/`service_role`.

`dados_anterior` é resquício de uma versão em que só se guardava um snapshot
para "desfazer". O app migra esse valor para dentro de `historico` no primeiro
carregamento; a coluna ficou na tabela só para não descartar dados de quem
ainda não abriu o app desde então.

### Formato dos registros

`dados`, e cada item de `historico` e `futuro`, têm a mesma forma:

```js
{ mesBase: 0..11, anoBase: 2026, itens: [...], fechadoEm?: ISOString }
```

E cada item:

```js
{ id, nome, valor, tipo: "fixo" }
{ id, nome, valor, tipo: "parcelado", paga, total }
```

## Regras de negócio

- **Fixos**: entram todo mês, sem data de fim.
- **Parcelado**: informa-se "já paguei X de Y". A parcela X é a do mês atual,
  então faltam `Y - X` meses depois deste.
- O mês **nunca vira sozinho** quando o calendário muda. Só pelos botões
  "fechar mês"/"abrir mês" — porque virar de mês significa dar mais uma
  parcela como paga em tudo, e isso é decisão do usuário, não do relógio.
- Cada usuário começa com caderno vazio, ancorado no mês em que criou a conta
  (lido do relógio do aparelho, em `novoCaderno()` dentro de `lib/caderno.js`).

### A linha do tempo (o conceito central)

Tudo gira em torno de um `offset` em `App.jsx`, relativo ao mês atual:

| offset | de onde vem | editável? |
| --- | --- | --- |
| `< 0` | `historico[offset + historico.length]` | sim, isolado naquele mês |
| `0` | `dados` — o mês atual de verdade | sim |
| `1..futuro.length` | `futuro[offset - 1]` | sim, isolado naquele mês |
| `> futuro.length` | calculado por `ativoEm()` a partir do último mês concreto | sim, mas grava no mês atual |

As mesmas setas ← → percorrem a linha inteira. Lançar/editar/remover num mês
de `historico` ou `futuro` grava **só naquele registro** (`salvarHistorico` /
`salvarFuturo`), sem tocar no mês atual nem nos meses entre eles.

**Fechar mês** (só habilitado em offset 0): empilha o mês atual no fim de
`historico` e avança. Se existir `futuro`, adota o primeiro item dele como
novo mês atual, preservando o que já foi planejado ali; se não existir,
aplica `fecharMes()` — avança cada parcela em 1 e remove as que acabaram.

**Abrir mês** (em qualquer mês de `historico`/`futuro`): torna aquele mês o
atual. Tudo que ficava depois dele — incluindo o mês atual antigo — é
reordenado para `futuro`. Nada é descartado, só muda de lista.

## Tema claro/escuro

`lib/tema.js` lê a preferência salva em `localStorage` (ou a do sistema),
alterna a classe `dark` no `<html>` e atualiza o `theme-color` do PWA.

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

## Observação sobre continuidade

Claude não guarda memória entre sessões de forma garantida. Este documento é
o que permite retomar o projeto sem reconstruir o contexto do zero. Vale
atualizá-lo sempre que houver mudança estrutural — e manter dentro do próprio
repositório, já que é ele (não uma pasta local) a referência de onde o
projeto está.
