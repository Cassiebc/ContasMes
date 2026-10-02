// Um Supabase de mentira, em memória, só com o que `repositorio.js` usa.
//
// Existe porque os bugs de consistência deste projeto moram na ordem das
// escritas, e isso `caderno.test.js` não alcança: ele só testa função pura.
// Aqui dá pra rodar duas operações ao mesmo tempo — o toque duplo, o app
// aberto em dois aparelhos — e olhar o que sobrou no banco.
//
// Cada consulta só executa quando é aguardada, um passo por vez, então duas
// chamadas concorrentes se intercalam como na rede: as duas leem antes de
// qualquer uma escrever. As duas regras do banco de verdade que importam pra
// isso estão aqui também: mês único por pessoa, um único mês atual, e o mês
// atual nunca é plano.

const DUPLICADO = { code: "23505", message: "duplicate key value" };
const RECUSADO = { code: "23514", message: "violates check constraint" };

export function criarBancoFalso() {
  const tabelas = { meses: [], lancamentos: [], cadernos: [] };
  let seq = 0;

  const violacao = (tabela, linha) => {
    if (tabela !== "meses") return null;
    if (linha.atual && linha.planejado) return RECUSADO;
    const outros = tabelas.meses.filter((m) => m.id !== linha.id && m.user_id === linha.user_id);
    if (outros.some((m) => m.ano === linha.ano && m.mes === linha.mes)) return DUPLICADO;
    if (linha.atual && outros.some((m) => m.atual)) return DUPLICADO;
    return null;
  };

  const comPadroes = (tabela, linha) => ({
    id: `id-${++seq}`,
    ...(tabela === "meses" ? { atual: false, fechado_em: null, planejado: false } : {}),
    ...linha,
  });

  class Consulta {
    constructor(tabela) {
      this.tabela = tabela;
      this.op = "select";
      this.filtros = [];
    }
    select(colunas, opcoes) {
      if (this.op === "select") {
        this.colunas = colunas;
        this.opcoes = opcoes;
      } else {
        this.devolve = true;
      }
      return this;
    }
    insert(linhas) { this.op = "insert"; this.valor = [].concat(linhas); return this; }
    update(valor) { this.op = "update"; this.valor = valor; return this; }
    delete() { this.op = "delete"; return this; }
    eq(coluna, v) { this.filtros.push((l) => l[coluna] === v); return this; }
    in(coluna, vs) { this.filtros.push((l) => vs.includes(l[coluna])); return this; }
    order() { return this; }
    maybeSingle() { this.um = true; return this; }
    single() { this.um = true; return this; }
    then(ok, falha) {
      return Promise.resolve().then(() => this.rodar()).then(ok, falha);
    }

    casam() {
      return tabelas[this.tabela].filter((l) => this.filtros.every((f) => f(l)));
    }
    resposta(linhas) {
      const copia = linhas.map((l) => ({ ...l }));
      return { data: this.um ? copia[0] ?? null : copia, error: null };
    }

    rodar() {
      const linhas = tabelas[this.tabela];

      if (this.op === "select") {
        const achadas = this.casam();
        if (this.opcoes?.head) return { count: achadas.length, error: null };
        const comFilhos = achadas.map((l) =>
          this.tabela === "meses" && this.colunas?.includes("lancamentos(")
            ? { ...l, lancamentos: tabelas.lancamentos.filter((x) => x.mes_id === l.id).map((x) => ({ ...x })) }
            : l
        );
        return this.resposta(comFilhos);
      }

      if (this.op === "insert") {
        const novas = this.valor.map((l) => comPadroes(this.tabela, l));
        for (const n of novas) {
          const erro = violacao(this.tabela, n);
          if (erro) return { data: null, error: erro };
        }
        linhas.push(...novas);
        return this.devolve ? this.resposta(novas) : { data: null, error: null };
      }

      if (this.op === "update") {
        const alvos = this.casam();
        for (const l of alvos) {
          const erro = violacao(this.tabela, { ...l, ...this.valor });
          if (erro) return { data: null, error: erro };
        }
        alvos.forEach((l) => Object.assign(l, this.valor));
        return this.devolve ? this.resposta(alvos) : { data: null, error: null };
      }

      // delete — os lançamentos saem junto com o mês, como no `on delete cascade`.
      const fora = new Set(this.casam().map((l) => l.id));
      tabelas[this.tabela] = linhas.filter((l) => !fora.has(l.id));
      if (this.tabela === "meses") {
        tabelas.lancamentos = tabelas.lancamentos.filter((l) => !fora.has(l.mes_id));
      }
      return { data: null, error: null };
    }
  }

  return {
    from: (tabela) => new Consulta(tabela),
    // Atalhos pros testes olharem o banco sem passar pelo repositório.
    tabelas: () => tabelas,
    lancamentosDe: (ano, mes) => {
      const m = tabelas.meses.find((x) => x.ano === ano && x.mes === mes);
      return m ? tabelas.lancamentos.filter((l) => l.mes_id === m.id) : null;
    },
  };
}
