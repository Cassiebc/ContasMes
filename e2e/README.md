# Testes de ponta a ponta

Playwright dirigindo o app real e conferindo o **banco** a cada passo, não só
a tela. Foi o que pegou todos os bugs de consistência do projeto — `npm test`
(Vitest) cobre as funções puras e não pegou nenhum deles.

## ⚠️ Antes de rodar

**Estes testes apagam e recriam os meses do usuário logado.** Não existe banco
de desenvolvimento separado: eles rodam contra o Supabase de produção.

Use uma **conta de teste**, nunca a sua. Criar uma é só abrir o app e tocar em
"não tenho conta ainda". Para apagá-la depois, é pelo painel do Supabase
(Authentication → Users) — a chave publishable não remove usuário.

## Configurar

As chaves do Supabase saem do `.env` da raiz, o mesmo que o Vite usa. Falta só
dizer qual conta usar:

```bash
export E2E_EMAIL='sua-conta-de-teste@exemplo.com'
export E2E_SENHA='...'
```

No PowerShell:

```powershell
$env:E2E_EMAIL = 'sua-conta-de-teste@exemplo.com'
$env:E2E_SENHA = '...'
```

E instale os navegadores do Playwright uma vez:

```bash
npx playwright install chromium
```

## Rodar

Com o app subido em outra janela (`npm run dev`):

```bash
npm run e2e         # só o fluxo completo (55 checagens)
npm run e2e:tudo    # os sete arquivos
```

Para testar contra produção ou contra um Preview em vez do local:

```bash
E2E_URL=https://caderno-auth.vercel.app npm run e2e
```

Vale rodar contra produção depois de publicar — foi assim que cada release
deste projeto foi conferida.

## O que cada um cobre

| Arquivo | Cobre |
| --- | --- |
| `workflow-completo.mjs` | O caminho inteiro: lançar, editar, apagar, fechar, abrir, planejar o futuro, descartar planejamento, apagar mês do histórico, backup e persistência. 55 checagens. |
| `voltar-ao-passado.mjs` | Mês atual adiantado e sem histórico: voltar meses, lançar num mês que não existia, reabrir como atual sem perder o que estava à frente. |
| `esvaziar-mes.mjs` | Apagar o último lançamento de um mês planejado e de um mês do passado — os dois já zeraram a projeção. |
| `virada-do-ano.mjs` | Voltar de janeiro para dezembro do ano anterior. O título já virou "undefined" aqui. |
| `instalar.mjs` | O convite de instalar o PWA: Android, iPhone, dispensar e reencontrar, e o caso de já estar instalado. |
| `conta-a-vista.mjs` | A conta à vista, que no banco é a parcela única (1 de 1): grava 1/1, não vai pra projeção, não atravessa o fechamento, fica no mês fechado, e editar não a transforma em parcelada. |
| `planejar-mes-a-frente.mjs` | Navegar até um mês futuro e lançar ali sem mexer no atual: a conta cai no mês certo, o mês nasce com a projeção junto, os meses do meio continuam alcançáveis, e fechar o atual vai pro próximo do calendário. |

## Como são escritos

- `ambiente.mjs` lê `.env` e as variáveis `E2E_*`, e falha com mensagem clara
  se faltar alguma.
- `estado.mjs` fala com o Supabase por HTTP direto — é o que permite conferir
  o que realmente foi para o banco, em vez de acreditar na tela.
- As capturas de tela vão para `e2e/telas/`, que o git ignora.

Ao mexer na linha do tempo, **reproduza o fluxo relatado antes de supor a
causa**. Várias vezes neste projeto a suspeita inicial estava errada, e o que
parecia bug novo era efeito colateral de uma correção anterior.
