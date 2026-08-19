# Caderno de Contas — versão com login

Controle de contas fixas e parceladas, com projeção dos próximos meses.
Cada pessoa cria sua conta e vê apenas os próprios lançamentos.
Os dados ficam no servidor, então o mesmo login mostra a mesma lista
no iPhone e no computador.

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

## 3. Pegar as chaves

Menu lateral → **Project Settings** → **API**. Você precisa de dois valores:

- **Project URL**
- **anon public** (a chave longa que começa com `eyJ`)

A chave `anon` é pública por design — ela sozinha não dá acesso a nada,
porque o RLS é quem decide. Nunca use a `service_role` aqui.

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

## 6. Instalar no iPhone

1. Abra a URL da Vercel **no Safari** (Chrome no iOS não oferece a opção)
2. Botão de compartilhar → role até **Adicionar à Tela de Início**
3. Confirme

Vira ícone na tela inicial e abre em tela cheia. A sessão fica salva —
você não precisa logar de novo toda vez.

## 7. O segundo usuário

Ele abre a mesma URL, toca em **não tenho conta ainda** e cria a dele.
Pronto: mesma aplicação, listas completamente separadas.

---

## Como o cálculo funciona

- **Fixos**: entram todo mês, sem fim
- **Parcelado**: você informa "já paguei X de Y". A parcela X é a do mês atual,
  então faltam `Y - X` meses depois deste
- **Fechar mês**: avança todas as parcelas em 1 e remove as que chegaram ao fim

## Sobre o mês inicial

Cada usuário começa com um caderno vazio, no mês em que criou a conta —
lido do relógio do próprio aparelho, na função `novoCaderno()` em `src/App.jsx`.

Depois disso o mês só avança pelo botão **fechar mês**. O app não vira de mês
sozinho quando o calendário muda: virar de mês significa dar mais uma parcela
como paga em tudo, e essa é uma decisão sua, não do relógio. Se você abrir em
dezembro e o cabeçalho ainda disser outubro, é porque faltou fechar dois meses.

## Sobre o modo offline

O service worker mantém a interface funcionando sem internet, mas os dados
agora vêm do servidor. Sem conexão, você consegue abrir o app e ver a última
tela carregada, mas não consegue salvar. É o preço de ter os dados sincronizados
entre aparelhos.
