# Caderno de Contas — contexto técnico

Documento de contexto para retomar o projeto em novas sessões.
Última atualização: 2026-09-02.

Se você é uma sessão nova: leia este arquivo inteiro antes de mexer em
qualquer coisa. Várias decisões aqui parecem estranhas e são deliberadas —
desfazer uma delas sem saber o porquê já reintroduziu bug duas vezes.

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
mesclada em `main` — por pull request, porque a `main` é protegida (veja
"Licença e código aberto").

**Mesclar na `main` publica em produção.** O projeto na Vercel está ligado ao
repositório no GitHub, então toda mudança nessa branch dispara um deploy
sozinho (dá pra confirmar pela URL `cadernocontas-git-main-*` nos deploys).
Push em `dev` não publica. `vercel --prod` continua funcionando para publicar
à mão, mas não é necessário.

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
    caderno.js      helpers puros (MESES, brl, ativoEm, ehAVista, rotuloMes,
                    fecharMes, deslocarMes, distanciaMeses, posDoMes,
                    baseDaProjecao, projetarItens)
    caderno.test.js testes da regra de negócio
    repositorio.js  todo o acesso ao banco; a tela não conhece SQL
    tema.js         hook useTema (claro/escuro + persistência)
    atualizacao.js  detecta versão nova publicada e recarrega o app
    instalacao.js   hook useInstalacao (convite de instalar o PWA)
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
    Instalar.jsx        convite de instalar: botão no login + aviso no mês
e2e/                testes de ponta a ponta (Playwright) — veja e2e/README.md
  ambiente.mjs      le .env e as variaveis E2E_*; falha claro se faltar
  estado.mjs        fala com o Supabase por HTTP, pra conferir o banco
  workflow-completo.mjs   o caminho inteiro, 55 checagens
  voltar-ao-passado.mjs   mes adiantado sem historico
  esvaziar-mes.mjs        apagar o ultimo lancamento
  virada-do-ano.mjs       voltar de janeiro pra dezembro
  instalar.mjs            o convite de instalar o PWA
  conta-a-vista.mjs       a compra que nao atravessa o mes
  planejar-mes-a-frente.mjs  lancar num mes futuro sem fechar o atual
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

### O que `repositorio.js` expõe

`App.jsx` não conhece SQL: tudo passa por aqui. Se precisar de uma operação
nova no banco, ela nasce neste arquivo, não na tela.

| função | o que faz |
| --- | --- |
| `carregar(userId)` | lê tudo e devolve `{ meses, dados, historico, futuro }`. Também **apaga** meses futuros vazios (veja regras de negócio). |
| `lancar(userId, mes, item)` | insere um lançamento; cria o mês se ele ainda não existir |
| `editarLancamento(id, item)` | atualiza um lançamento |
| `removerLancamento(id)` | apaga um lançamento |
| `apagarMes(mesId)` | apaga o mês e, em cascata, seus lançamentos |
| `definirAtual(userId, mesId)` | move a marca de `atual` para um mês que já existe |
| `abrirMesNoBanco(userId, mes)` | idem, mas **cria o mês** se preciso — é o "abrir mês" num mês do passado que nunca foi registrado |
| `fecharMesNoBanco(...)` | marca `fechado_em` e passa `atual` pro seguinte, criando-o com as parcelas avançadas |
| `substituirTudo(userId, caderno)` | restaurar backup: troca o caderno inteiro |
| `migrarDoFormatoAntigo(userId)` | traz os dados da tabela `cadernos` (jsonb) pro modelo novo |

Duas defesas que vale não remover sem entender:

- `migrarDoFormatoAntigo` guarda a promessa em andamento e devolve a mesma
  para quem chamar durante a migração. Sem isso, duas migrações concorrentes
  (o efeito roda duas vezes em desenvolvimento, ou duas abas abertas) brigavam
  pelas mesmas linhas e davam 409.
- O código de erro `23505` do Postgres (chave duplicada) é tratado como
  "já está lá", não como falha. É o que torna a migração repetível.

## Regras de negócio

- **Fixos**: entram todo mês, sem data de fim.
- **Parcelado**: informa-se "já paguei X de Y". A parcela X é a do mês atual,
  então faltam `Y - X` meses depois deste.
- **À vista**: a compra que não se repete — fica só no mês em que foi lançada
  e não aparece no seguinte.
- **"Já paguei" é a parcela deste mês**, não quantas já saíram da conta.
  Digitar `0` vira `1` em silêncio: `gravarForm()` faz
  `Math.max(1, parseInt(form.paga) || 1)` e `0` é falsy em JavaScript. O banco
  recusaria o zero de todo jeito (`check paga >= 1`). Consequência: não há como
  dizer "comprei, mas a primeira parcela só cai no mês que vem" — o app sempre
  entende que a primeira é a deste mês.

### À vista é a parcela única, não um tipo novo

Vale saber antes de "consertar": **não existe `tipo = 'avista'` no banco.**
Uma conta à vista é gravada como `parcelado` com `paga = 1, total = 1`, e
`ehAVista()` (em `lib/caderno.js`) é quem a reconhece.

O motivo é que o modelo que já existia se comporta exatamente assim, sem
nenhuma linha nova de regra:

- `ativoEm()` — `faltam` é `1 - 1 = 0`, então ela só passa no offset 0;
- `fecharMes()` — a parcela avança pra 2, ultrapassa o total e ela é
  descartada ao virar o mês;
- a projeção, o backup JSON e as constraints `parcelas_coerentes` já valem
  sem tocar em nada.

Um tipo `'avista'` pediria `alter table` (que só a usuária roda) e abriria um
terceiro caminho em cada `if` que hoje só tem dois — `paraItem`, `paraLinha`,
`faltam`, `ativoEm`, `fecharMes`, `escreverMeses` —, com o risco conhecido
deste projeto: basta um deles esquecer e volta bug de consistência.

O que a tela faz com `ehAVista()`:

- seção própria "à vista" em `AbaMes` e `AbaMesHistorico`, e subtotal próprio
  no `CardTotal` (que só aparece quando existe alguma);
- esconde o "01/01 · última" no `Secao` — o título da seção já diz o que é;
- tira essas contas do "última parcela: X" da projeção (`encerramEm`), porque
  elas nunca estiveram nos meses seguintes;
- reabre o formulário no segmento certo ao editar (`abrirEdicao` no `App.jsx`).
  Sem isso, salvar de novo um lançamento à vista o transformaria em parcelado.

No CSV a coluna `tipo` sai como "à vista" e as de parcela vão vazias. O JSON
de backup guarda o `1 de 1` como está, então ele volta idêntico.
- O mês **nunca vira sozinho** quando o calendário muda. Só pelos botões
  "fechar mês"/"abrir mês" — porque virar de mês significa dar mais uma
  parcela como paga em tudo, e isso é decisão do usuário, não do relógio.
- Cada usuário começa com caderno vazio, ancorado no mês em que criou a conta
  (lido do relógio do aparelho, em `novoCaderno()` dentro de `lib/caderno.js`).

### Como a tela lê a linha do tempo

`App.jsx` trabalha com um `offset` que é **distância em meses** até o atual,
nos dois sentidos. Um passo é sempre um mês do calendário, tenha registro no
banco ou não:

| offset | de onde vem | onde o lançamento grava |
| --- | --- | --- |
| `< 0` | o registro daquele mês no histórico; se não houver, mês vazio (nada é projetado para trás) | naquele mês, criando-o se preciso |
| `0` | `dados` — o mês atual | no mês atual |
| `> 0` | o registro planejado daquele mês; se não houver, a projeção calculada por `ativoEm()` a partir de `baseDaProjecao()` | naquele mês, criando-o **com a projeção junto** |

A simetria é o ponto: a posição de um mês não muda por ele passar a existir,
nem por um vizinho deixar de existir. Veja "A linha do tempo anda pelo
calendário" mais abaixo — as duas metades já quebraram pelo mesmo motivo.

`historico` e `futuro` não são guardados: `repositorio.carregar()` os deriva
comparando cada mês com o que está marcado como atual.

As mesmas setas ‹ › percorrem a linha inteira. Toda alteração vai pro banco e
o caderno é relido — a tela é sempre reflexo do banco, nunca uma cópia que
foi se afastando dele. Depois de reler, `reancorar()` reposiciona o `offset`
no mês que estava na tela: uma escrita pode reordenar a linha do tempo, e o
mesmo passo passaria a apontar pra outro mês.

**Fechar mês**: marca `fechado_em` no mês atual e passa `atual` pro **mês
seguinte do calendário** — não pro `futuro[0]`, que era o bug de fechar
setembro e cair em novembro quando só novembro estava planejado. Se esse mês
seguinte já existe (foi planejado), ele é adotado com o que tiver dentro; se
não, é criado com `fecharMes()` — cada parcela avança uma casa e as que
acabaram somem.

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

## Instalar na tela inicial

O app já cumpria os requisitos de instalação (manifest com `standalone`,
ícones de 192 e 512, maskable, service worker com `fetch`, HTTPS) — o que
faltava era **descoberta**: no Android o caminho é o menu ⋮ → "Instalar app",
que quase ninguém procura.

`lib/instalacao.js` captura o evento `beforeinstallprompt` **no topo do
módulo**, não dentro de um efeito: o Chrome dispara cedo, muitas vezes antes
do React montar, e um listener registrado depois perde o evento. O convite
fica guardado numa variável do módulo e os componentes se inscrevem para
saber quando ele chega.

Dois pontos de entrada, um para cada momento:

- `BotaoInstalar` — na **tela de login**, abaixo de "não tenho conta ainda".
  É a casa permanente do convite: aparece a todo login de quem ainda não
  instalou e não guarda dispensa, então é sempre o caminho de volta.
- `AvisoInstalar` — cartão dispensável na aba "o mês", para quem já está
  dentro. Some pra sempre quando dispensado (`localStorage`) ou quando o app
  é instalado.

Os dois somem quando o app já está instalado. Ficou fora de "projeção": ali
era pouco visto, que foi o motivo de sair.

No **iPhone não existe** `beforeinstallprompt`: o Safari só instala pelo botão
de compartilhar. Aí o botão abre um alerta ensinando o caminho, em vez de
tentar chamar uma API que não existe.

Detalhe que é fácil errar: `e.preventDefault()` no evento é obrigatório —
sem ele o Chrome mostra a barra de instalação dele por cima da nossa. E o
convite **só serve uma vez**; depois de usado tem que ser descartado.

## A linha do tempo anda pelo calendário, não pelos registros

As setas ‹ › andam pelo **calendário** nos dois sentidos, não pela lista de
meses que existem no banco. Um passo é sempre um mês; se ele não tiver
registro, abre vazio (no passado) ou projetado (no futuro), e só vira linha no
banco se receber lançamento.

Isso já foi diferente nos dois lados, e nos dois deu o mesmo bug. Vale ler as
duas metades juntas, porque a segunda foi consertada copiando a primeira.

### Para trás (corrigido antes)

O passo contava registros (`-historico.length`), e isso criava dois becos sem
saída:

- quem tinha o mês atual adiantado e **nenhum histórico** não tinha para onde
  voltar. A seta nascia desabilitada. Como "Abrir mês" só aparece quando você
  está *em* um mês, a saída que existia para corrigir o mês errado era
  inalcançável justamente para quem precisava dela;
- quem tinha histórico **não contíguo** (agosto registrado, setembro e
  outubro não) pulava de novembro direto para agosto, e os meses do meio
  ficavam inalcançáveis para sempre.

Três coisas sustentam isso:

**`posDoMes` (em `caderno.js`)** diz em que passo um mês aparece. Hoje é
`distanciaMeses(dados, alvo)` e nada mais — nem olha `historico` ou `futuro`.
A posição de agosto **não muda** quando agosto passa a existir.

**A tela reancora pelo mês depois de cada escrita.** `executar()` relê o
caderno e chama `reancorar()`, que reposiciona o `offset` no mês que estava na
tela. Sem isso, lançar em agosto reordenava a linha do tempo e o mesmo passo
passava a apontar para junho — a tela pulava sozinha.

**Nada é projetado para trás.** `itensEm()` devolve `[]` para um mês passado
sem registro. Projeção é afirmação sobre o que vai acontecer; do passado não
se infere nada. Se projetasse, as contas fixas de hoje apareceriam num mês que
a pessoa nunca registrou, e as parcelas viriam com número negativo.

`abrirMesNoBanco()` cria a linha antes de marcar como atual, porque agora dá
para pedir "abrir mês" em um mês que ainda não existe.

### Para frente (corrigido depois, do mesmo jeito)

A assimetria que ficou de pé na correção anterior era real e custou um bug:
**não dava para planejar um mês à frente pela tela.** Navegar até novembro e
lançar fazia a conta cair em setembro, porque a zona de projeção não tinha
registro próprio e `mesDaTela()` caía no mês atual.

Consertar só isso não bastava, e é o que vale entender antes de mexer aqui.
Assim que novembro passasse a existir, com `offset` contando registros ele
viraria o **passo 1** — e outubro, que nunca existiu, sumia da linha do tempo
para sempre. Pior: `virarMes()` usava `futuro[0]` como "o próximo", então
fechar setembro pularia direto para novembro e outubro nunca chegaria a
existir. Um bug de navegação virava perda de mês.

A correção é a mesma do passado, e agora as duas metades são a mesma regra:

**O passo é calendário para frente também.** `posDoMes` virou uma linha, e
`registroEm()` procura o mês pela data nas duas listas, em vez de indexar
`futuro` por posição.

**`baseDaProjecao(alvo, { dados, futuro })`** decide de onde a projeção de um
mês parte: o último mês que **existe antes dele** — o planejado mais recente,
ou o atual quando não há planejamento no meio. Antes a projeção partia sempre
do último planejado da lista, então planejar dezembro fazia novembro projetar
a partir de dezembro, que vem depois dele.

**`virarMes()` fecha no próximo do calendário**, procurando em `futuro` o mês
que de fato é o seguinte, em vez de pegar `futuro[0]`.

**Lançar num mês à frente materializa a projeção junto.** `projetarItens()`
gera os itens daquele mês com as parcelas já na casa certa, e `repo.lancar()`
os grava como "semente" quando o mês está nascendo. Sem isso, um novembro
guardando só o IPVA valeria menos que outubro na projeção e, ao ser adotado
num fechamento, levaria as contas fixas embora — o bug do planejamento vazio
entrando por outra porta.

O preço disso, e é uma escolha consciente: o mês planejado é um **retrato**,
não uma fórmula. Se o aluguel mudar de valor em setembro depois de novembro já
ter sido planejado, novembro fica com o valor antigo até ser editado. É o
mesmo comportamento que `fecharMes()` já tinha ao materializar o mês seguinte.

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

**O jeito normal é abrir um PR de `dev` para `main` e mesclar** — push direto
na `main` é recusado desde que o repositório virou público e o ruleset
`protecao-main` passou a valer. Mesclado o PR, a Vercel publica sozinha, em
poucos segundos. `vercel --prod` continua funcionando pra publicar à mão, mas
não é necessário.

As duas variáveis (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) precisam
estar cadastradas em Settings → Environment Variables no painel da Vercel, e o
build precisa rodar **depois** de cadastradas.

Push em `dev` gera um Preview, protegido por login da Vercel, no endereço fixo
`https://cadernocontas-git-dev-cassiebcs.vercel.app`. É o mesmo Supabase de
produção — Preview não é sandbox.

Depois de publicar, vale conferir por conteúdo e não só pelo hash do arquivo:

```bash
curl -s https://caderno-auth.vercel.app/ | grep -o 'assets/index-[^"]*\.js'
```

Ao mudar de projeto Supabase, lembre de atualizar o host no `connect-src` da
CSP em `vercel.json` — senão o app carrega mas nenhuma requisição passa.

## Instalação no celular

- **iPhone**: abrir a URL no Safari (Chrome no iOS não oferece a opção) →
  compartilhar → "Adicionar à Tela de Início".
- **Android**: Chrome mostra prompt de instalação ou menu ⋮ → "Instalar app".

## Como testar

Dois níveis, e o segundo é o que importa.

```bash
npm test        # Vitest: funcoes puras de lib/caderno.js
npm run build   # o build tem que passar antes de qualquer commit
npm run e2e     # Playwright: o fluxo completo, 55 checagens
npm run e2e:tudo  # os sete arquivos de e2e/
```

`npm test` cobre só as funções puras — cálculo de parcela, virada de mês,
rótulo do mês, `posDoMes`. É rápido e vale rodar sempre, mas **nenhum dos bugs
de consistência do projeto foi pego por ele**.

O que pegou foi ponta a ponta: Playwright dirigindo o app real contra o
Supabase e conferindo **o banco** a cada passo, não a tela. A suíte está em
`e2e/`, com instruções em `e2e/README.md`.

Dois avisos que valem repetir: **os testes e2e apagam e recriam os meses do
usuário logado** — use conta de teste, nunca a real, porque não existe banco
de desenvolvimento separado. E vale rodar contra produção depois de publicar
(`E2E_URL=https://caderno-auth.vercel.app npm run e2e`); foi assim que cada
release deste projeto foi conferida.

Reproduza o fluxo relatado antes de supor a causa — várias vezes a suspeita
inicial estava errada, e o que parecia bug novo era efeito colateral de uma
correção anterior.

Cenários que já quebraram, e por isso valem revisitar ao mexer na linha do
tempo:

- fechar mês com um planejamento vazio à frente → as contas fixas sumiam;
- lançar parcela num mês e depois abrir um mês anterior → a parcela sumia da
  projeção dos meses seguintes;
- restaurar backup por cima de um caderno diferente → o mês duplicava;
- apagar o último lançamento de um mês planejado → aquele mês zerava;
- migração rodando duas vezes ao mesmo tempo (o efeito roda duas vezes em
  desenvolvimento, ou o app está aberto em duas abas);
- mês atual adiantado e sem histórico nenhum → a seta de voltar nascia
  desabilitada, e não havia como corrigir o mês errado;
- lançar num mês do passado que ainda não existia → a tela pulava pra outro
  mês, porque a linha do tempo se reordenou sob o `offset`;
- voltar de janeiro → o título virava "undefined", porque `%` em JavaScript
  devolve negativo. Só apareceria na virada do ano;
- navegar até um mês à frente e lançar → a conta caía no mês atual, porque a
  zona de projeção não tinha registro próprio;
- planejar novembro sem planejar outubro → outubro sumia da linha do tempo, e
  fechar setembro pulava direto para novembro.

## Manutenção: as coisas que mais aparecem

**Mudar o schema.** O app usa a chave publishable, que não altera estrutura de
tabela. Todo `alter table` tem que ser rodado pela usuária no SQL Editor do
Supabase. Entregue o comando pronto e espere ela confirmar **antes** de
escrever o código que depende da coluna nova.

**Mexer no script de tema do `index.html`.** Ele é liberado na CSP por hash
sha256. Trocar uma vírgula ali sem recalcular o hash em `vercel.json` faz o
navegador bloqueá-lo **silenciosamente**: nenhum erro no código, e o app volta
a piscar branco antes de escurecer. O arquivo tem CRLF e o parser HTML
normaliza pra LF antes de somar o hash — por isso a CSP lista os dois valores.

**Trocar de projeto Supabase.** Além das variáveis, atualize o host no
`connect-src` da CSP em `vercel.json`. Senão o app carrega e nenhuma
requisição passa.

**Mudar o `sw.js`.** O arquivo é byte a byte o mesmo em todo deploy, então o
navegador nunca o considera novo. Se mudar a estratégia de cache, o conteúdo
precisa mudar para o navegador sequer perceber.

**Autoria dos commits.** O git das máquinas usadas aqui não tem
`user.name`/`user.email` configurados e inventa um e-mail corporativo. Passe a
identidade por variável de ambiente em todo commit:

```
GIT_AUTHOR_NAME="Bruna Cássia" GIT_AUTHOR_EMAIL="109704012+Cassiebc@users.noreply.github.com" GIT_COMMITTER_NAME="Bruna Cássia" GIT_COMMITTER_EMAIL="109704012+Cassiebc@users.noreply.github.com" git commit -m "..."
```

**Limpeza que ainda está pendente** (nenhuma é urgente, todas dependem de
combinar antes):

- a tabela `cadernos` (formato jsonb antigo) segue no banco como rede de
  segurança da migração;
- a coluna `lancamentos.origem_id`, que existe só para a migração ser
  repetível;
- contas de teste criadas para os e2e — só a usuária remove, pelo painel do
  Supabase.

## Licença e código aberto

O projeto é licenciado sob **MIT** desde 2026-08-25 — o texto está em
`LICENSE`, na raiz, com o copyright em nome de Bruna Cássia dos Santos
Simões. A escolha foi deliberada: MIT é a licença de toda a stack do projeto
(React, Vite, Tailwind, `supabase-js`), é curta o bastante para ser lida, e a
cláusula de ausência de garantia importa num app que projeta contas a pagar.
AGPL foi considerada e descartada — protege contra um cenário que não se
aplica a um projeto pessoal e afasta contribuidor casual.

O repositório era privado até essa data. Abrir o código **não** muda o modelo
de segurança, e vale entender por quê antes de mexer aqui:

- a chave que vai no bundle é publishable/anon, **pública por design**; quem
  abre o DevTools em produção já a tem;
- quem protege os dados é o RLS do Postgres, aplicado no banco, não a
  obscuridade do `schema-v2.sql`;
- não há segredo no histórico do Git — conferido commit a commit; `.env` e
  `.env*` estão no `.gitignore`, e o `.env.example` só tem placeholder;
- o único identificador exposto é a ref do projeto Supabase no `connect-src`
  da CSP em `vercel.json`, que já vai no cabeçalho de todo response em
  produção.

O que muda com o código aberto é só isto: fork não toca neste repositório, e
pull request de fora não publica nada — publicar exige mesclar na `main`, e só
a dona da conta faz isso. O caminho realista para um deploy ruim continua sendo
mesclar um PR sem ler.

A `main` é protegida pelo ruleset `protecao-main`, criado em 2026-08-25: exige
pull request, bloqueia force push e impede apagar a branch (confirmado pela API
pública — `pull_request`, `non_fast_forward`, `deletion`). Ele só passou a
valer quando o repositório virou público: ruleset em repositório privado exige
plano pago, e fica salvo mas sem efeito. Mexer nisso é pelo painel do GitHub —
o `gh` não está instalado nas máquinas usadas.

Sobre autoria: o código é escrito com assistência do Claude Code, e isso está
registrado no README e nos trailers `Co-Authored-By` dos commits. A
titularidade é da usuária: ferramenta não é autora, e o crédito de quem
participou de cada mudança vive no histórico, não na licença.

## Observação sobre continuidade

Claude não guarda memória entre sessões de forma garantida. Este documento é
o que permite retomar o projeto sem reconstruir o contexto do zero. Vale
atualizá-lo sempre que houver mudança estrutural — e manter dentro do próprio
repositório, já que é ele (não uma pasta local) a referência de onde o
projeto está.
