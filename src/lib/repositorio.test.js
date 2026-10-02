import { describe, it, expect, beforeEach, vi } from "vitest";
import { criarBancoFalso } from "./bancoFalso";

const banco = vi.hoisted(() => ({ atual: null }));
vi.mock("../supabase", () => ({
  supabase: { from: (tabela) => banco.atual.from(tabela) },
}));

const repo = await import("./repositorio.js");
const { fecharMes, itensNoMes, completarAoAbrir } = await import("./caderno.js");

const EU = "usuaria";
const SETEMBRO = { mesBase: 8, anoBase: 2026 };
const OUTUBRO = { mesBase: 9, anoBase: 2026 };
const NOVEMBRO = { mesBase: 10, anoBase: 2026 };

const ALUGUEL = { nome: "Aluguel", valor: 350, tipo: "fixo" };
const NOTEBOOK = { nome: "Notebook", valor: 300, tipo: "parcelado", paga: 2, total: 10 };
const IPVA = { nome: "IPVA", valor: 800, tipo: "parcelado", paga: 1, total: 1 };
const INTERNET = { nome: "Internet", valor: 100, tipo: "fixo" };

const nomes = (linhas) => linhas.map((l) => l.nome).sort();
const plano = (mes) => ({ ...mes, planejado: true });
const noBanco = (mes) => banco.atual.lancamentosDe(mes.anoBase, mes.mesBase);

// Setembro como mês atual, com uma fixa e uma parcelada.
const abrirSetembro = async () => {
  await repo.substituirTudo(EU, { dados: { ...SETEMBRO, itens: [ALUGUEL, NOTEBOOK] } });
  return repo.carregar(EU);
};

// O que a tela faz ao tocar em "Fechar mês".
const fechar = (est) =>
  repo.fecharMesNoBanco(EU, est.dados, fecharMes(est.dados).itens, {
    mesBase: fecharMes(est.dados).mesBase,
    anoBase: fecharMes(est.dados).anoBase,
  });

beforeEach(() => {
  banco.atual = criarBancoFalso();
});

describe("lançar num mês à frente", () => {
  it("o mês nasce como plano, só com o que foi lançado nele", async () => {
    await abrirSetembro();
    await repo.lancar(EU, plano(OUTUBRO), IPVA);

    expect(nomes(noBanco(OUTUBRO))).toEqual(["IPVA"]);
    const { dados, futuro } = await repo.carregar(EU);
    expect(dados.mesBase).toBe(8);
    expect(nomes(dados.itens)).toEqual(["Aluguel", "Notebook"]);
    expect(futuro).toHaveLength(1);
    expect(futuro[0].planejado).toBe(true);
  });

  // O relato: lançou em outubro, depois lançou em setembro, e a conta de
  // setembro não apareceu mais na projeção.
  it("conta nova no mês atual continua chegando ao mês planejado", async () => {
    await abrirSetembro();
    await repo.lancar(EU, plano(OUTUBRO), IPVA);
    const { dados } = await repo.carregar(EU);
    await repo.lancar(EU, dados, INTERNET);

    const est = await repo.carregar(EU);
    expect(nomes(itensNoMes(OUTUBRO, est))).toEqual(["Aluguel", "IPVA", "Internet", "Notebook"]);
    expect(nomes(itensNoMes(NOVEMBRO, est))).toEqual(["Aluguel", "Internet", "Notebook"]);
  });

  it("apagar o que foi lançado à frente devolve o mês à projeção", async () => {
    await abrirSetembro();
    await repo.lancar(EU, plano(OUTUBRO), IPVA);
    let est = await repo.carregar(EU);
    await repo.removerLancamento(est.futuro[0].itens[0].id);

    est = await repo.carregar(EU);
    expect(est.futuro).toEqual([]);
    expect(noBanco(OUTUBRO)).toBeNull();
    expect(nomes(itensNoMes(OUTUBRO, est))).toEqual(["Aluguel", "Notebook"]);
  });

  it("mês do passado não nasce como plano", async () => {
    await abrirSetembro();
    await repo.lancar(EU, { mesBase: 7, anoBase: 2026, planejado: false }, IPVA);
    const { historico } = await repo.carregar(EU);
    expect(historico[0].planejado).toBe(false);
  });
});

describe("fechar mês", () => {
  it("cria o mês seguinte com as parcelas avançadas", async () => {
    await fechar(await abrirSetembro());

    const depois = await repo.carregar(EU);
    expect(depois.dados.mesBase).toBe(9);
    expect(nomes(depois.dados.itens)).toEqual(["Aluguel", "Notebook"]);
    expect(depois.dados.itens.find((i) => i.nome === "Notebook").paga).toBe(3);
    expect(depois.historico.map((m) => m.mesBase)).toEqual([8]);
  });

  it("com o mês seguinte planejado, soma as contas ao que já estava lançado nele", async () => {
    await abrirSetembro();
    await repo.lancar(EU, plano(OUTUBRO), IPVA);
    await fechar(await repo.carregar(EU));

    const depois = await repo.carregar(EU);
    expect(depois.dados.mesBase).toBe(9);
    expect(depois.dados.planejado).toBe(false);
    expect(nomes(depois.dados.itens)).toEqual(["Aluguel", "IPVA", "Notebook"]);
    expect(depois.dados.itens.find((i) => i.nome === "Notebook").paga).toBe(3);
    expect(depois.futuro).toEqual([]);
  });

  // O relato inteiro, de ponta a ponta: lança em outubro, lança em setembro,
  // apaga o de outubro, fecha setembro. Outubro tem de sair com cada conta uma
  // vez só, e com a que entrou em setembro depois.
  it("o caminho relatado termina com cada conta uma vez só", async () => {
    await abrirSetembro();
    await repo.lancar(EU, plano(OUTUBRO), IPVA);
    let est = await repo.carregar(EU);
    await repo.lancar(EU, est.dados, INTERNET);
    est = await repo.carregar(EU);
    await repo.removerLancamento(est.futuro[0].itens[0].id);
    await fechar(await repo.carregar(EU));

    expect(nomes(noBanco(OUTUBRO))).toEqual(["Aluguel", "Internet", "Notebook"]);
  });

  it("planejar novembro não faz o fechamento pular outubro", async () => {
    await abrirSetembro();
    await repo.lancar(EU, plano(NOVEMBRO), IPVA);
    await fechar(await repo.carregar(EU));

    const depois = await repo.carregar(EU);
    expect(depois.dados.mesBase).toBe(9);
    expect(nomes(depois.dados.itens)).toEqual(["Aluguel", "Notebook"]);
    expect(nomes(itensNoMes(NOVEMBRO, depois))).toEqual(["Aluguel", "IPVA", "Notebook"]);
  });

  // O toque duplo no "Fechar mês" do alerta: as duas chamadas saem da mesma
  // tela, com o mesmo retrato de setembro, e nenhuma sabe da outra.
  it("tocar duas vezes não duplica o mês seguinte", async () => {
    const est = await abrirSetembro();
    await Promise.allSettled([fechar(est), fechar(est)]);

    expect(nomes(noBanco(OUTUBRO))).toEqual(["Aluguel", "Notebook"]);
    expect((await repo.carregar(EU)).dados.mesBase).toBe(9);
  });

  it("tocar duas vezes não duplica nem com o mês seguinte planejado", async () => {
    await abrirSetembro();
    await repo.lancar(EU, plano(OUTUBRO), IPVA);
    const est = await repo.carregar(EU);
    await Promise.allSettled([fechar(est), fechar(est)]);

    expect(nomes(noBanco(OUTUBRO))).toEqual(["Aluguel", "IPVA", "Notebook"]);
  });

  // Outubro foi planejado no computador; o celular ficou com a tela de antes,
  // em que outubro não existia, e é dele que sai o "fechar mês".
  it("aparelho com a tela atrasada fecha certo mesmo assim", async () => {
    const telaVelha = await abrirSetembro();
    await repo.lancar(EU, plano(OUTUBRO), IPVA);
    await fechar(telaVelha);

    expect(nomes(noBanco(OUTUBRO))).toEqual(["Aluguel", "IPVA", "Notebook"]);
  });

  // Outro aparelho já fechou setembro. Fechar de novo a partir da tela velha
  // não pode fechar nada nem somar contas a outubro.
  it("fechar um mês que já foi fechado em outro aparelho não faz nada", async () => {
    const telaVelha = await abrirSetembro();
    await fechar(telaVelha);
    await fechar(telaVelha);

    expect(nomes(noBanco(OUTUBRO))).toEqual(["Aluguel", "Notebook"]);
    const depois = await repo.carregar(EU);
    expect(depois.dados.mesBase).toBe(9);
    expect(depois.futuro).toEqual([]);
  });

  // Voltou de outubro pra setembro com "abrir mês": outubro já foi vivido e
  // fica à frente como retrato. Fechar setembro de novo o adota como está.
  it("mês seguinte que já foi vivido é adotado como está", async () => {
    await fechar(await abrirSetembro());
    let est = await repo.carregar(EU);
    await repo.lancar(EU, est.dados, INTERNET);
    est = await repo.carregar(EU);
    await repo.abrirMesNoBanco(EU, est.historico[0]);

    est = await repo.carregar(EU);
    expect(est.dados.mesBase).toBe(8);
    expect(est.futuro[0].planejado).toBe(false);
    await fechar(est);

    expect(nomes(noBanco(OUTUBRO))).toEqual(["Aluguel", "Internet", "Notebook"]);
  });
});

describe("abrir mês", () => {
  it("abrir um mês planejado traz junto as contas que ele herdava", async () => {
    await abrirSetembro();
    await repo.lancar(EU, plano(OUTUBRO), IPVA);
    const est = await repo.carregar(EU);
    await repo.abrirMesNoBanco(EU, est.futuro[0], completarAoAbrir(est.futuro[0], est));

    const depois = await repo.carregar(EU);
    expect(depois.dados.mesBase).toBe(9);
    expect(depois.dados.planejado).toBe(false);
    expect(nomes(depois.dados.itens)).toEqual(["Aluguel", "IPVA", "Notebook"]);
    expect(depois.dados.itens.find((i) => i.nome === "Notebook").paga).toBe(3);
  });

  it("abrir um mês à frente que nem existia não o deixa vazio", async () => {
    const est = await abrirSetembro();
    await repo.abrirMesNoBanco(EU, plano(NOVEMBRO), completarAoAbrir(plano(NOVEMBRO), est));

    const depois = await repo.carregar(EU);
    expect(depois.dados.mesBase).toBe(10);
    expect(nomes(depois.dados.itens)).toEqual(["Aluguel", "Notebook"]);
    expect(depois.dados.itens.find((i) => i.nome === "Notebook").paga).toBe(4);
  });

  it("o plano que ficou pra trás vira histórico completo, não pela metade", async () => {
    await abrirSetembro();
    await repo.lancar(EU, plano(OUTUBRO), IPVA);
    const est = await repo.carregar(EU);
    await repo.abrirMesNoBanco(EU, plano(NOVEMBRO), completarAoAbrir(plano(NOVEMBRO), est));

    const depois = await repo.carregar(EU);
    const outubro = depois.historico.find((m) => m.mesBase === 9);
    expect(nomes(outubro.itens)).toEqual(["Aluguel", "IPVA", "Notebook"]);
    expect(outubro.planejado).toBe(false);
    expect(nomes(depois.dados.itens)).toEqual(["Aluguel", "Notebook"]);
  });
});

describe("backup", () => {
  it("restaurar guarda quem era plano e quem era retrato", async () => {
    await repo.substituirTudo(EU, {
      dados: { ...SETEMBRO, itens: [ALUGUEL] },
      futuro: [
        { ...OUTUBRO, itens: [IPVA], planejado: true },
        { ...NOVEMBRO, itens: [NOTEBOOK] },
      ],
    });
    const { futuro } = await repo.carregar(EU);
    expect(futuro.map((m) => m.planejado)).toEqual([true, false]);
  });

  it("o mês atual e o histórico nunca voltam como plano", async () => {
    await repo.substituirTudo(EU, {
      dados: { ...SETEMBRO, itens: [ALUGUEL], planejado: true },
      historico: [{ mesBase: 7, anoBase: 2026, itens: [ALUGUEL], planejado: true }],
    });
    const { dados, historico } = await repo.carregar(EU);
    expect(dados.planejado).toBe(false);
    expect(historico[0].planejado).toBe(false);
  });
});
