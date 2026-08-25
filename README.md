# Caderno de Contas — versão com login

Controle de contas fixas e parceladas, com projeção dos próximos meses e
histórico dos meses já fechados. Cada pessoa cria sua conta e vê apenas os
próprios lançamentos. Os dados ficam no servidor, então o mesmo login mostra
a mesma lista no iPhone e no computador.

---

## 1. Criar o projeto no Supabase

1. Vá em supabase.com e crie a conta (plano gratuito serve)
2. **New project** — escolha um nome, uma senha para o banco (guarde, mas
   você não vai precisar dela no dia a dia) e a região `South America (São Paulo)`
3. Espere uns 2 minutos enquanto ele provisiona

## 2. Criar as tabelas

No menu lateral, **SQL Editor** → **New query**. Cole todo o conteúdo do
arquivo `schema-v2.sql` que está nesta pasta e clique em **Run**.

Isso cria as tabelas `meses` e `lancamentos` e liga o Row Level Security — as
políticas garantem, **no banco**, que ninguém lê nem escreve os dados de outra
pessoa. Não é uma checagem do frontend que dá para burlar pelo DevTools.

O arquivo também põe no banco as regras que antes só o código tentava
lembrar: um mês não pode se repetir, só existe um mês atual por pessoa, uma
parcela nunca é "5 de 3" e valor tem que ser positivo. Se algo tentar gravar
fora disso, o banco recusa.

Pode rodar o arquivo mais de uma vez sem quebrar nada.

> O `schema.sql` (sem o `-v2`) é do formato antigo, que guardava o caderno
> inteiro num campo JSON. Ficou no repositório só como referência — não é mais
> preciso rodar. Quem já usava esse formato não precisa fazer nada: o app leva
> os dados para as tabelas novas sozinho, na primeira vez que abre, e a tabela
> antiga continua no banco intacta.

## 3. Pegar as chaves

Menu lateral → **Project Settings** → **API Keys**. Você precisa de dois valores:

- **Project URL**
- A chave **publishable** (`sb_publishable_...`) — em projetos antigos ela
  aparece como **anon public** e começa com `eyJ`

Essa chave é pública por design: ela vai embutida no site e qualquer pessoa
consegue lê-la. Ela sozinha não dá acesso a nada, porque o RLS é quem decide o
que cada usuário enxerga. **Nunca** use aqui a chave secreta (`sb_secret_...`
ou `service_role`) — essa ignora o RLS e daria acesso total ao banco.

## 4. Rodar no computador

```bash
npm install
cp .env.example .env
```

Abra o `.env` e cole os dois valores do passo anterior. Depois:

```bash
npm run dev
```

Abra http://localhost:5173 e crie sua conta. O caderno começa vazio,
ancorado no mês corrente — use **lançar conta** para o primeiro item.

Para rodar os testes da regra de negócio (fechar mês, cálculo de parcelas):

```bash
npm test
```

E os testes de ponta a ponta, que dirigem o app de verdade e conferem o banco
a cada passo:

```bash
npx playwright install chromium   # uma vez
npm run e2e
```

Eles precisam de uma conta de teste — **não use a sua**, porque apagam e
recriam os meses do usuário. As instruções estão em `e2e/README.md`.

### Confirmação de e-mail

Por padrão o Supabase exige confirmar o e-mail antes do primeiro login.
Se você preferir entrar direto, vá em **Authentication → Sign In / Providers →
Email** e desligue **Confirm email**. Para uso pessoal entre duas pessoas
conhecidas, tudo bem desligar.

## 5. Publicar na Vercel

Na primeira vez:

```bash
npm i -g vercel
vercel login
vercel --prod
```

Aceite os padrões. **Antes de funcionar**, cadastre as mesmas duas variáveis
no painel da Vercel: projeto → **Settings** → **Environment Variables** →
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`. Depois rode `vercel --prod`
mais uma vez, para que o build enxergue as variáveis.

### Depois disso, publicar é mesclar na `main`

Com o projeto ligado ao GitHub, a Vercel publica sozinha:

| você faz | acontece |
| --- | --- |
| mescla um PR na `main` | **publica em produção**, em poucos segundos |
| push em `dev` | gera um Preview, protegido por login da Vercel |

Ou seja: **"mesclar na `main`" e "publicar" são a mesma decisão.** Não existe
passo de confirmação depois.

Neste repositório a `main` é protegida por um ruleset: push direto nela é
recusado, e force push e apagar a branch também. O caminho é abrir um pull
request de `dev` para `main`. Num fork seu essa proteção não existe até você
criar a sua — regra de branch é configuração do repositório, não vem no
código.

O Preview do `dev` fica num endereço fixo, que sempre aponta para o topo da
branch — dá para testar ali antes de publicar. Só lembre que ele usa **o mesmo
banco de produção**: Preview não é sandbox.

> Se você trocar de projeto Supabase, atualize também o endereço dele no
> `connect-src` da política de segurança em `vercel.json`. Senão o app abre,
> mas nenhuma requisição ao banco passa.

## 6. Instalar no celular

O próprio app oferece: há um botão **instalar na tela inicial** na tela de
login, e um aviso dispensável na aba "o mês" para quem já entrou. Os dois
somem sozinhos depois de instalado.

Se preferir o caminho manual:

- **iPhone**: abra a URL **no Safari** (Chrome no iOS não oferece a opção) →
  botão de compartilhar → **Adicionar à Tela de Início**
- **Android**: menu ⋮ → **Instalar app**

Vira ícone na tela inicial e abre em tela cheia. A sessão fica salva —
você não precisa logar de novo toda vez.

Duas coisas que confundem e não são defeito: quando sai versão nova, o app
instalado se atualiza sozinho ao voltar para o primeiro plano — mas pode ser
preciso fechá-lo de vez uma vez. E **trocar o ícone do app não muda o atalho
já criado**: o sistema guarda o ícone de quando você instalou, então é preciso
remover e adicionar o atalho de novo.

## 7. O segundo usuário

Ele abre a mesma URL, toca em **não tenho conta ainda** e cria a dele.
Pronto: mesma aplicação, listas completamente separadas.

---

## Como usar

### As três abas

- **o mês** — os lançamentos do mês que você está vendo, com o total
- **projeção** — quanto cada um dos próximos meses vai custar, e o backup
  (baixar JSON/CSV, restaurar)
- **histórico** — os meses já fechados; tocar em um leva você até ele

### Navegar entre os meses

As setas ‹ › no topo percorrem a linha do tempo inteira: meses já fechados,
o mês atual e os meses à frente. Você pode lançar, editar e apagar contas em
**qualquer** um deles.

Para trás dá para ir mesmo em meses que você nunca registrou — eles abrem
vazios, prontos para receber o que você pagou. É a saída para quando o mês
atual ficou adiantado demais: volte até o mês certo e toque em **abrir mês**.

O detalhe que faz isso ser seguro: o que você mexe num mês passado ou futuro
fica **só naquele mês**. Não recalcula nem bagunça os outros.

### Fechar mês

Avança o caderno para o mês seguinte: cada parcela conta como mais uma paga, e
as que terminaram somem. O mês que você fechou vai para o histórico, inteiro,
do jeito que estava.

Só dá para fechar o mês atual — nos outros o botão fica apagado.

Se você já tinha planejado o mês seguinte (lançou algo nele antes de chegar
lá), fechar o mês simplesmente adota esse planejamento em vez de recalcular.

### Abrir mês

Fechou um mês por engano, ou quer voltar a trabalhar num mês anterior? Navegue
até ele e toque em **abrir mês**: ele volta a ser o mês atual.

Os meses que ficavam depois dele não são perdidos — passam a contar como
"meses futuros planejados", continuam lá e continuam editáveis. Nada é movido
nem apagado: só muda qual mês é considerado o atual.

### Tema claro/escuro

O botão de lua no topo alterna. A escolha fica salva no aparelho; sem escolha,
ele segue o tema do sistema.

---

## Como o cálculo funciona

- **Fixos**: entram todo mês, sem fim
- **Parcelado**: você informa "já paguei X de Y". A parcela X é a do mês atual,
  então faltam `Y - X` meses depois deste
- **Fechar mês**: avança todas as parcelas em 1 e remove as que chegaram ao fim

## Sobre o mês inicial

Cada usuário começa com um caderno vazio, no mês em que criou a conta —
lido do relógio do próprio aparelho, na função `novoCaderno()` em
`src/lib/caderno.js`.

Depois disso o mês só muda pelos botões **fechar mês** e **abrir mês**. O app
não vira de mês sozinho quando o calendário muda: virar de mês significa dar
mais uma parcela como paga em tudo, e essa é uma decisão sua, não do relógio.
Se você abrir em dezembro e o cabeçalho ainda disser outubro, é porque faltou
fechar dois meses.

## Sobre o modo offline

O service worker mantém a interface funcionando sem internet, mas os dados
vêm do servidor. Sem conexão, você consegue abrir o app e ver a última
tela carregada, mas não consegue salvar — e um aviso aparece avisando disso.
É o preço de ter os dados sincronizados entre aparelhos.

## Segurança

O isolamento entre usuários é feito pelo Row Level Security do Postgres, no
banco — não por checagem no navegador. Auditado: tentar ler ou escrever os
dados de outra pessoa retorna vazio ou erro 403, mesmo com a chave pública em
mãos.

O banco também recusa dado incoerente (mês repetido, dois meses atuais,
parcela impossível, valor negativo), em vez de confiar que o app vai lembrar
de conferir.

O `vercel.json` também define cabeçalhos de segurança (CSP, proteção contra
clickjacking, entre outros). Se você mexer no script de tema dentro do
`index.html`, precisa recalcular o hash dele na CSP — há um comentário no
próprio arquivo lembrando disso.

---

## Licença

Este projeto é software livre, sob a licença **MIT** — o texto completo está
em `LICENSE`, na raiz.

Na prática: você pode usar, copiar, modificar e distribuir o código, inclusive
comercialmente, sem pedir permissão. A única exigência é manter o aviso de
copyright junto. E, como toda licença permissiva, ela vem sem garantia: o
software é fornecido "como está", e quem o usa assume o risco — vale lembrar
que aqui se trata de projeção de contas a pagar, não de contabilidade
auditada.

## Se você clonou este repositório

O app não vem com banco: cada instalação usa **o seu próprio projeto no
Supabase**, criado pelos passos 1 a 4 acima. Nada aqui aponta para o banco de
ninguém — a chave que vai no `.env` é a sua.

O mesmo vale para os testes de ponta a ponta: as variáveis `E2E_*` precisam
apontar para o seu projeto, e eles apagam e recriam os meses do usuário de
teste. Detalhes em `e2e/README.md`.

Correções e sugestões são bem-vindas por issue ou pull request.

## Como este projeto foi feito

O código foi escrito com a ajuda do **Claude Code**, a ferramenta de
programação assistida por IA da Anthropic. A direção do projeto é humana: as
decisões de arquitetura, o formato do código, os testes, a revisão de cada
mudança e a definição do que é bug e do que é comportamento desejado são de
Bruna Cássia dos Santos Simões.

Fica registrado aqui por transparência, e porque explica um traço do
repositório: as mensagens de commit são longas de propósito, contando o
*porquê* de cada mudança, e o `contexto-tecnico.md` existe para que qualquer
pessoa — ou qualquer sessão nova de IA — retome o projeto sem repetir erros já
resolvidos. Várias decisões que parecem estranhas são deliberadas, e o
documento diz quais e por quê.
