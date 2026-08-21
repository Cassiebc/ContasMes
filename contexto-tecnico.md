# Caderno de Contas — contexto técnico

Documento de contexto para retomar o projeto em novas sessões.
Última atualização: 2026-08-21.

## O que é

App de controle de contas fixas e parceladas, com projeção dos próximos meses.
Multiusuário: cada pessoa cria a própria conta e vê apenas os próprios
lançamentos. Dados no servidor, então o mesmo login mostra a mesma lista no
celular e no computador.

## Onde fica

O repositório Git é a fonte de verdade — não a pasta local, já que o projeto
é trabalhado de máquinas diferentes (casa e trabalho). Antes de começar uma
sessão, clonar/atualizar o repositório e trabalhar a partir dele, em vez de
assumir um caminho fixo.

Já existe uma pasta `.vercel` no repositório — o projeto foi publicado na Vercel.

## Stack

- React 18.3 + Vite 6
- Tailwind CSS 4 (via `@tailwindcss/vite`)
- `@supabase/supabase-js` 2.47 — auth (e-mail/senha) e persistência
- Deploy: Vercel
- PWA: manifest + service worker, instalável no iPhone e no Android

## Estrutura de arquivos

```
index.html          meta tags PWA, link do manifest, apple-touch-icon
vercel.json         rewrite de todas as rotas para /index.html (SPA)
vite.config.js
schema.sql          script único para rodar no SQL Editor do Supabase
.env / .env.example VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
src/
  main.jsx          entrypoint
  App.jsx           (~19 KB) o app inteiro: lançamentos, projeção, fechar mês
  Login.jsx         tela de login / criar conta
  supabase.js       cria o client a partir das env vars
  index.css
public/
  manifest.json     display standalone, portrait, theme #f5f5f4
  sw.js             service worker, cache "caderno-v1", network-first
  icon-180.png / icon-192.png / icon-512.png
```

## Banco (Supabase)

Uma única tabela:

```sql
create table public.cadernos (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  dados      jsonb not null,
  updated_at timestamptz not null default now()
);
```

RLS ligado, com 4 políticas (select / insert / update / delete), todas
`auth.uid() = user_id`. O isolamento entre usuários é garantido **no banco**,
não no frontend. O caderno inteiro de um usuário é um blob jsonb na coluna
`dados` — uma linha por pessoa.

Usa a chave `anon` (pública por design; o RLS é quem protege). Nunca a
`service_role`.

## Regras de negócio

- **Fixos**: entram todo mês, sem data de fim.
- **Parcelado**: informa-se "já paguei X de Y". A parcela X é a do mês atual,
  então faltam `Y - X` meses depois deste.
- **Fechar mês**: avança todas as parcelas em 1 e remove as que chegaram ao fim.
- O mês **nunca vira sozinho** quando o calendário muda. Só pelo botão
  "fechar mês" — porque virar de mês significa dar mais uma parcela como paga
  em tudo, e isso é decisão do usuário, não do relógio.
- Cada usuário começa com caderno vazio, ancorado no mês em que criou a conta
  (lido do relógio do aparelho, em `novoCaderno()` dentro de `src/App.jsx`).

## Offline

O service worker mantém a **interface** funcionando sem internet, mas os dados
vêm do servidor. Sem conexão dá para abrir o app e ver a última tela carregada,
mas não dá para salvar.

## Deploy

`vercel --prod`. As duas variáveis (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) precisam estar cadastradas em
Settings → Environment Variables no painel da Vercel, e o build precisa rodar
**depois** de cadastradas.

## Instalação no celular

- **iPhone**: abrir a URL no Safari (Chrome no iOS não oferece a opção) →
  compartilhar → "Adicionar à Tela de Início".
- **Android**: Chrome mostra prompt de instalação ou menu ⋮ → "Instalar app".
  Funciona com o manifest atual.

## Melhorias identificadas (não aplicadas ainda)

- Ícones do manifest sem `"purpose": "maskable"` — no Android o ícone aparece
  encaixado dentro de um fundo branco em vez de preencher a forma do sistema.
- Sem `sizes` de ícone acima de 512 e sem screenshots no manifest (afeta a
  qualidade do prompt de instalação no Android).

## Observação sobre continuidade

Claude não guarda memória entre sessões de forma garantida. Este documento é
o que permite retomar o projeto sem reconstruir o contexto do zero. Vale
atualizá-lo sempre que houver mudança estrutural — e manter dentro do próprio
repositório, já que é ele (não uma pasta local) a referência de onde o
projeto está.
