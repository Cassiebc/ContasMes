# Caderno de Contas

Antes de qualquer tarefa neste repositório, leia `contexto-tecnico.md` na
raiz — ele tem o contexto do projeto: stack, estrutura de arquivos, schema
do banco (Supabase), regras de negócio (fixos, parcelas, linha do tempo de
meses) e decisões de arquitetura. Sem isso, é fácil tomar uma decisão que
contraria algo já definido de propósito (ex: o mês não vira sozinho no
calendário).

Atualize `contexto-tecnico.md` sempre que houver mudança estrutural no
projeto, para a próxima sessão não perder o contexto.

## Fluxo de trabalho

- Commits vão para `dev`. Só depois de testado é que `dev` é mesclada em
  `main`. Confirme com a usuária antes de mesclar e antes de dar push.
- **Push em `main` publica em produção na hora** — a Vercel está ligada ao
  GitHub e faz o deploy sozinha. Trate "dar push em main" e "publicar" como a
  mesma decisão, e deixe isso explícito ao pedir o aval dela. Push em `dev`
  não publica.
- Rode `npm test` e `npm run build` antes de propor um commit.

## Armadilhas conhecidas

**Autoria dos commits.** O git desta máquina não tem `user.name`/`user.email`
configurados, então ele inventa um e-mail corporativo. Passe a identidade por
variável de ambiente em todo commit:

```
GIT_AUTHOR_NAME="Bruna Cássia" GIT_AUTHOR_EMAIL="109704012+Cassiebc@users.noreply.github.com" \
GIT_COMMITTER_NAME="Bruna Cássia" GIT_COMMITTER_EMAIL="109704012+Cassiebc@users.noreply.github.com" \
git commit -m "..."
```

**Hash da CSP.** O `index.html` tem um script inline que aplica o tema antes
do primeiro paint. Ele é liberado na Content-Security-Policy do `vercel.json`
por hash sha256. Se mexer nesse script sem recalcular o hash, o navegador o
bloqueia em produção e o app volta a piscar branco — sem erro visível no
código. O arquivo tem CRLF, e o parser HTML normaliza para LF antes de somar
o hash; por isso a CSP lista os dois.

**Mudanças de schema.** O app usa a chave publishable, que não altera
estrutura de tabela. Qualquer `alter table` precisa ser rodado pela usuária no
SQL Editor do Supabase — entregue o comando pronto e espere ela confirmar
antes de escrever o código que depende da coluna nova.

**Testar no navegador exige conta.** As telas úteis ficam atrás do login. Não
existe banco de desenvolvimento separado: testes end-to-end usam o Supabase de
produção. Combine com a usuária antes de criar conta de teste, e avise que ela
precisará apagá-la depois pelo painel (a chave publishable não remove usuário).

**O banco é `meses` + `lancamentos`, não mais um jsonb.** Todo acesso passa
por `src/lib/repositorio.js`; `App.jsx` não fala com o Supabase direto. A
tabela `cadernos` continua no banco com os dados no formato antigo, como rede
de segurança, e o repositório migra sozinho na primeira abertura de quem ainda
não migrou — não apague essa tabela sem combinar.

**Mês à frente sem lançamento não é planejamento.** Guardar esse registro
zerava a projeção daquele mês e, num fechamento, apagava as contas fixas — foi
bug real duas vezes. `carregar()` descarta esses meses. Mês *fechado* vazio
fica: "nesse mês não tive contas" é informação de verdade.

**Bugs de consistência vinham de regra espalhada.** Cada operação cuidava da
sua parte e bastava uma esquecer. Hoje o banco recusa dado incoerente
(constraints) e a tela relê o caderno depois de cada escrita, em vez de manter
uma cópia própria. Ao mexer aqui, mantenha as duas coisas: regra no banco
quando der, e uma leitura só como fonte de verdade.

**A linha do tempo anda pelo calendário para trás, por registros para
frente.** Um passo atrás é sempre o mês anterior, exista ou não; um passo à
frente conta os meses planejados. Se mexer nisso, lembre que `offset` guarda
**passos**, não meses — e que uma escrita pode reordenar a linha do tempo, por
isso `executar()` reancora a posição pelo mês (`posDoMes`) depois de reler.
Sem a reancoragem, lançar num mês do passado joga a tela para outro mês.

## Como testar de verdade

`npm test` cobre só as funções puras. O que pegou os bugs desta semana foram
testes de ponta a ponta com Playwright, dirigindo o app real contra o Supabase
e conferindo o banco a cada passo — vale reproduzir o fluxo relatado antes de
supor a causa. Cenários que já quebraram e valem revisitar:

- fechar mês com um planejamento vazio à frente (as contas fixas sumiam);
- lançar parcela num mês, abrir um mês anterior e conferir a projeção (a
  parcela sumia dos meses seguintes);
- restaurar backup por cima de um caderno diferente (mês duplicava);
- apagar o último lançamento de um mês planejado (o mês zerava a projeção);
- estando num mês adiantado e sem histórico, voltar meses e lançar lá
  (a seta nascia desabilitada e não havia como corrigir o mês errado).
