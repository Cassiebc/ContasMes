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

## 2. Criar a tabela

No menu lateral, **SQL Editor** → **New query**. Cole todo o conteúdo do
arquivo `schema.sql` que está nesta pasta e clique em **Run**.

Isso cria a tabela `cadernos` e liga o Row Level Security — as quatro políticas
garantem, **no banco**, que ninguém lê nem escreve na linha de outra pessoa.
Não é uma checagem do frontend que dá para burlar pelo DevTools.

> Se o banco já existe e você só quer aplicar uma coluna nova, rode apenas as
> linhas `alter table ... add column if not exists` do `schema.sql`. Rodar o
> arquivo inteiro de novo dá erro nos `create policy`, que não aceitam
> "se não existir".

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

### Confirmação de e-mail

Por padrão o Supabase exige confirmar o e-mail antes do primeiro login.
Se você preferir entrar direto, vá em **Authentication → Sign In / Providers →
Email** e desligue **Confirm email**. Para uso pessoal entre duas pessoas
conhecidas, tudo bem desligar.

## 5. Publicar na Vercel

```bash
npm i -g vercel
vercel login
vercel --prod
```

Aceite os padrões. **Antes de funcionar**, você precisa cadastrar as mesmas
duas variáveis no painel da Vercel: projeto → **Settings** → **Environment
Variables** → adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

Depois rode `vercel --prod` mais uma vez, para que o build enxergue as variáveis.

> Se você trocar de projeto Supabase, atualize também o endereço dele no
> `connect-src` da política de segurança em `vercel.json`. Senão o app abre,
> mas nenhuma requisição ao banco passa.

## 6. Instalar no celular

- **iPhone**: abra a URL **no Safari** (Chrome no iOS não oferece a opção) →
  botão de compartilhar → **Adicionar à Tela de Início**
- **Android**: o Chrome mostra o prompt de instalação, ou menu ⋮ →
  **Instalar app**

Vira ícone na tela inicial e abre em tela cheia. A sessão fica salva —
você não precisa logar de novo toda vez.

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

As setas ← → no topo percorrem a linha do tempo inteira: meses já fechados,
o mês atual e os meses à frente. Você pode lançar, editar e apagar contas em
**qualquer** um deles.

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

Os meses que ficavam depois dele não são perdidos — viram "meses futuros
planejados", continuam lá e continuam editáveis. É só uma reordenação.

### Tema claro/escuro

O link **escuro**/**claro** no topo alterna. A escolha fica salva no aparelho;
sem escolha, ele segue o tema do sistema.

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
banco — não por checagem no navegador. Auditado: tentar ler ou escrever na
linha de outra pessoa retorna vazio ou erro 403, mesmo com a chave pública em
mãos.

O `vercel.json` também define cabeçalhos de segurança (CSP, proteção contra
clickjacking, entre outros). Se você mexer no script de tema dentro do
`index.html`, precisa recalcular o hash dele na CSP — há um comentário no
próprio arquivo lembrando disso.
