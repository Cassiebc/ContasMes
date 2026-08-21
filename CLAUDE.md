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
