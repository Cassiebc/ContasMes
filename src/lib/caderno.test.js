import { describe, it, expect } from "vitest";
import { faltam, ativoEm, rotuloMes, fecharMes, ehPlanejamentoVazio, ehAVista,
  deslocarMes,
  posDoMes,
  distanciaMeses,
  itensNoMes,
  projetarItens,
} from "./caderno";

describe("ehPlanejamentoVazio", () => {
  it("mês sem lançamento é planejamento vazio", () => {
    expect(ehPlanejamentoVazio({ mesBase: 8, anoBase: 2026, itens: [] })).toBe(true);
  });

  it("mês com lançamento não é", () => {
    expect(ehPlanejamentoVazio({ mesBase: 8, anoBase: 2026, itens: [{ id: "1", valor: 10 }] })).toBe(false);
  });

  it("aguenta mês nulo ou sem a lista de itens", () => {
    expect(ehPlanejamentoVazio(null)).toBe(true);
    expect(ehPlanejamentoVazio({ mesBase: 8, anoBase: 2026 })).toBe(true);
  });
});

describe("faltam", () => {
  it("fixo nunca termina", () => {
    expect(faltam({ tipo: "fixo" })).toBe(Infinity);
  });

  it("parcelado: faltam total - paga", () => {
    expect(faltam({ tipo: "parcelado", paga: 3, total: 10 })).toBe(7);
  });

  it("parcelado na ultima parcela: faltam 0", () => {
    expect(faltam({ tipo: "parcelado", paga: 10, total: 10 })).toBe(0);
  });
});

describe("ativoEm", () => {
  it("fixo esta ativo em qualquer offset", () => {
    const it_ = { tipo: "fixo" };
    expect(ativoEm(it_, 0)).toBe(true);
    expect(ativoEm(it_, 50)).toBe(true);
  });

  it("parcelado esta sempre ativo no mes base (offset 0)", () => {
    expect(ativoEm({ tipo: "parcelado", paga: 10, total: 10 }, 0)).toBe(true);
  });

  it("parcelado fica inativo depois que as parcelas restantes acabam", () => {
    const it_ = { tipo: "parcelado", paga: 8, total: 10 }; // faltam 2
    expect(ativoEm(it_, 1)).toBe(true);
    expect(ativoEm(it_, 2)).toBe(true);
    expect(ativoEm(it_, 3)).toBe(false);
  });
});

describe("rotuloMes", () => {
  it("mes dentro do mesmo ano", () => {
    expect(rotuloMes(0, 2026, 2)).toEqual({ nome: "março", ano: 2026 });
  });

  it("vira o ano ao passar de dezembro", () => {
    expect(rotuloMes(11, 2026, 1)).toEqual({ nome: "janeiro", ano: 2027 });
  });

  it("mes base sem offset", () => {
    expect(rotuloMes(8, 2026, 0)).toEqual({ nome: "setembro", ano: 2026 });
  });
});

describe("fecharMes", () => {
  it("fixo permanece igual", () => {
    const r = fecharMes({
      itens: [{ id: "1", tipo: "fixo", nome: "Aluguel", valor: 1000 }],
      mesBase: 0,
      anoBase: 2026,
    });
    expect(r.itens).toEqual([{ id: "1", tipo: "fixo", nome: "Aluguel", valor: 1000 }]);
  });

  it("parcelado avanca a parcela paga em 1", () => {
    const r = fecharMes({
      itens: [{ id: "1", tipo: "parcelado", nome: "Notebook", valor: 100, paga: 3, total: 10 }],
      mesBase: 0,
      anoBase: 2026,
    });
    expect(r.itens[0].paga).toBe(4);
  });

  it("remove parcelado que chegou ao fim (paga ultrapassa total)", () => {
    const r = fecharMes({
      itens: [
        { id: "1", tipo: "parcelado", nome: "Celular", valor: 50, paga: 10, total: 10 },
        { id: "2", tipo: "fixo", nome: "Internet", valor: 80 },
      ],
      mesBase: 0,
      anoBase: 2026,
    });
    expect(r.itens.map((i) => i.id)).toEqual(["2"]);
  });

  it("avanca o mes base em 1 dentro do mesmo ano", () => {
    const r = fecharMes({ itens: [], mesBase: 0, anoBase: 2026 });
    expect(r.mesBase).toBe(1);
    expect(r.anoBase).toBe(2026);
  });

  it("vira o ano ao fechar dezembro", () => {
    const r = fecharMes({ itens: [], mesBase: 11, anoBase: 2026 });
    expect(r.mesBase).toBe(0);
    expect(r.anoBase).toBe(2027);
  });

  it("nao muta o array de itens original", () => {
    const original = [{ id: "1", tipo: "parcelado", nome: "Notebook", valor: 100, paga: 3, total: 10 }];
    fecharMes({ itens: original, mesBase: 0, anoBase: 2026 });
    expect(original[0].paga).toBe(3);
  });
});

describe("deslocarMes", () => {
  it("anda pra frente dentro do mesmo ano", () => {
    expect(deslocarMes(0, 2026, 3)).toEqual({ mesBase: 3, anoBase: 2026 });
  });

  it("anda pra tras dentro do mesmo ano", () => {
    // novembro (10) menos 3 = agosto (7) — o caso da usuaria presa em novembro
    expect(deslocarMes(10, 2026, -3)).toEqual({ mesBase: 7, anoBase: 2026 });
  });

  it("volta pro ano anterior sem quebrar", () => {
    // janeiro menos 1 = dezembro do ano passado. O `%` do JS daria -1 aqui.
    expect(deslocarMes(0, 2026, -1)).toEqual({ mesBase: 11, anoBase: 2025 });
  });

  it("volta mais de um ano", () => {
    expect(deslocarMes(1, 2026, -14)).toEqual({ mesBase: 11, anoBase: 2024 });
  });

  it("avanca pro ano seguinte", () => {
    expect(deslocarMes(11, 2026, 1)).toEqual({ mesBase: 0, anoBase: 2027 });
  });
});

describe("rotuloMes na virada do ano", () => {
  it("nomeia o mes certo voltando de janeiro", () => {
    expect(rotuloMes(0, 2026, -1)).toEqual({ nome: "dezembro", ano: 2025 });
  });

  it("nomeia o mes certo voltando de fevereiro", () => {
    expect(rotuloMes(1, 2026, -3)).toEqual({ nome: "novembro", ano: 2025 });
  });
});

describe("posDoMes", () => {
  const mes = (mesBase, anoBase, itens = []) => ({ mesBase, anoBase, itens });

  it("acha o mes atual no passo zero", () => {
    const est = { dados: mes(10, 2026), historico: [], futuro: [] };
    expect(posDoMes({ mesBase: 10, anoBase: 2026 }, est)).toBe(0);
  });

  it("acha um mes do historico pelo indice", () => {
    const est = { dados: mes(10, 2026), historico: [mes(8, 2026), mes(9, 2026)], futuro: [] };
    expect(posDoMes({ mesBase: 8, anoBase: 2026 }, est)).toBe(-2);
    expect(posDoMes({ mesBase: 9, anoBase: 2026 }, est)).toBe(-1);
  });

  it("acha um mes planejado", () => {
    const est = { dados: mes(10, 2026), historico: [], futuro: [mes(11, 2026)] };
    expect(posDoMes({ mesBase: 11, anoBase: 2026 }, est)).toBe(1);
  });

  it("conta pra tras um mes que nao existe", () => {
    // novembro atual, sem historico: agosto fica tres passos atras
    const est = { dados: mes(10, 2026), historico: [], futuro: [] };
    expect(posDoMes({ mesBase: 7, anoBase: 2026 }, est)).toBe(-3);
  });

  it("a posicao de um mes do passado nao muda quando ele passa a existir", () => {
    // Esse e o ponto da navegacao por calendario: agosto fica no passo -3 de
    // novembro tendo registro ou nao. Antes ele pulava de -3 pra -1 assim que
    // recebia um lancamento, e a tela ia parar em junho.
    const alvo = { mesBase: 7, anoBase: 2026 };
    const antes = { dados: mes(10, 2026), historico: [], futuro: [] };
    const depois = { dados: mes(10, 2026), historico: [mes(7, 2026)], futuro: [] };
    expect(posDoMes(alvo, antes)).toBe(-3);
    expect(posDoMes(alvo, depois)).toBe(-3);
  });

  it("mantem alcancaveis os meses entre o atual e um historico antigo", () => {
    // historico so tem agosto, mas setembro e outubro precisam ter posicao
    // propria — senao a seta pula direto pra agosto e eles somem.
    const est = { dados: mes(10, 2026), historico: [mes(7, 2026)], futuro: [] };
    expect(posDoMes({ mesBase: 9, anoBase: 2026 }, est)).toBe(-1);
    expect(posDoMes({ mesBase: 8, anoBase: 2026 }, est)).toBe(-2);
    expect(posDoMes({ mesBase: 7, anoBase: 2026 }, est)).toBe(-3);
  });

  it("atravessa a virada do ano pra tras", () => {
    const est = { dados: mes(1, 2026), historico: [], futuro: [] };
    expect(posDoMes({ mesBase: 10, anoBase: 2025 }, est)).toBe(-3);
  });

  it("conta pra frente alem do ultimo planejado", () => {
    const est = { dados: mes(10, 2026), historico: [], futuro: [mes(11, 2026)] };
    expect(posDoMes({ mesBase: 1, anoBase: 2027 }, est)).toBe(3);
  });
});

describe("distanciaMeses", () => {
  it("conta dentro do ano", () => {
    expect(distanciaMeses({ mesBase: 7, anoBase: 2026 }, { mesBase: 10, anoBase: 2026 })).toBe(3);
  });
  it("conta atravessando o ano", () => {
    expect(distanciaMeses({ mesBase: 10, anoBase: 2025 }, { mesBase: 1, anoBase: 2026 })).toBe(3);
  });
  it("conta pra tras", () => {
    expect(distanciaMeses({ mesBase: 10, anoBase: 2026 }, { mesBase: 7, anoBase: 2026 })).toBe(-3);
  });
});

describe("ehAVista", () => {
  it("parcela unica e conta a vista", () => {
    expect(ehAVista({ tipo: "parcelado", paga: 1, total: 1 })).toBe(true);
  });

  it("parcelado de verdade nao e, nem na ultima parcela", () => {
    expect(ehAVista({ tipo: "parcelado", paga: 1, total: 10 })).toBe(false);
    expect(ehAVista({ tipo: "parcelado", paga: 3, total: 3 })).toBe(false);
  });

  it("fixo nao e", () => {
    expect(ehAVista({ tipo: "fixo" })).toBe(false);
  });

  it("aparece so no mes em que foi lancada", () => {
    // E o motivo de a conta a vista nao precisar de tipo novo no banco: a
    // parcela unica ja se comporta exatamente assim.
    const compra = { tipo: "parcelado", paga: 1, total: 1 };
    expect(ativoEm(compra, 0)).toBe(true);
    expect(ativoEm(compra, 1)).toBe(false);
    expect(ativoEm(compra, 2)).toBe(false);
  });

  it("nao atravessa o fechamento do mes", () => {
    const r = fecharMes({
      itens: [
        { id: "1", tipo: "parcelado", nome: "Mercado", valor: 200, paga: 1, total: 1 },
        { id: "2", tipo: "fixo", nome: "Internet", valor: 80 },
      ],
      mesBase: 7,
      anoBase: 2026,
    });
    expect(r.itens.map((i) => i.id)).toEqual(["2"]);
  });
});

describe("posDoMes para frente", () => {
  const mes = (mesBase, anoBase, itens = []) => ({ mesBase, anoBase, itens });

  it("a posicao de um mes futuro nao muda quando ele passa a existir", () => {
    // O espelho do caso do passado. Setembro atual, novembro tres... dois
    // passos a frente: ele fica no passo 2 tendo registro ou nao. Antes ele
    // pulava pro passo 1 assim que recebia um lancamento, e outubro sumia.
    const alvo = { mesBase: 10, anoBase: 2026 };
    const antes = { dados: mes(8, 2026), historico: [], futuro: [] };
    const depois = { dados: mes(8, 2026), historico: [], futuro: [mes(10, 2026)] };
    expect(posDoMes(alvo, antes)).toBe(2);
    expect(posDoMes(alvo, depois)).toBe(2);
  });

  it("mantem alcancaveis os meses entre o atual e um planejamento distante", () => {
    // Planejou novembro sem planejar outubro: outubro precisa ter passo
    // proprio, senao a seta pula de setembro pra novembro e ele fica perdido.
    const est = { dados: mes(8, 2026), historico: [], futuro: [mes(10, 2026)] };
    expect(posDoMes({ mesBase: 9, anoBase: 2026 }, est)).toBe(1);
    expect(posDoMes({ mesBase: 10, anoBase: 2026 }, est)).toBe(2);
    expect(posDoMes({ mesBase: 11, anoBase: 2026 }, est)).toBe(3);
  });

  it("atravessa a virada do ano pra frente", () => {
    const est = { dados: mes(10, 2026), historico: [], futuro: [] };
    expect(posDoMes({ mesBase: 1, anoBase: 2027 }, est)).toBe(3);
  });
});

describe("itensNoMes", () => {
  const SET = { mesBase: 8, anoBase: 2026 };
  const OUT = { mesBase: 9, anoBase: 2026 };
  const NOV = { mesBase: 10, anoBase: 2026 };
  const DEZ = { mesBase: 11, anoBase: 2026 };

  const aluguel = { id: "a", tipo: "fixo", nome: "Aluguel", valor: 350 };
  const notebook = { id: "n", tipo: "parcelado", nome: "Notebook", valor: 300, paga: 2, total: 10 };
  const ipva = { id: "i", tipo: "parcelado", nome: "IPVA", valor: 800, paga: 1, total: 1 };
  const academia = { id: "g", tipo: "fixo", nome: "Academia", valor: 90 };

  const retrato = (mes, itens) => ({ ...mes, itens, planejado: false });
  const plano = (mes, itens) => ({ ...mes, itens, planejado: true });
  const nomes = (itens) => itens.map((i) => i.nome).sort();

  it("sem nada planejado, e o mes atual com as parcelas avancadas", () => {
    const est = { dados: retrato(SET, [aluguel, notebook]), futuro: [] };
    const nov = itensNoMes(NOV, est);
    expect(nomes(nov)).toEqual(["Aluguel", "Notebook"]);
    expect(nov.find((i) => i.nome === "Notebook").paga).toBe(4);
  });

  it("o plano soma ao que vem do mes atual, em vez de substituir", () => {
    const est = { dados: retrato(SET, [aluguel, notebook]), futuro: [plano(OUT, [ipva])] };
    expect(nomes(itensNoMes(OUT, est))).toEqual(["Aluguel", "IPVA", "Notebook"]);
  });

  // O bug relatado: outubro planejado guardava uma copia de setembro, e o que
  // entrasse em setembro depois nao chegava a outubro nem a mes nenhum adiante.
  it("conta lancada no mes atual DEPOIS do plano aparece no mes planejado", () => {
    const antes = { dados: retrato(SET, [aluguel]), futuro: [plano(OUT, [ipva])] };
    const depois = { ...antes, dados: retrato(SET, [aluguel, notebook]) };
    expect(nomes(itensNoMes(OUT, antes))).toEqual(["Aluguel", "IPVA"]);
    expect(nomes(itensNoMes(OUT, depois))).toEqual(["Aluguel", "IPVA", "Notebook"]);
    expect(nomes(itensNoMes(DEZ, depois))).toEqual(["Aluguel", "Notebook"]);
  });

  it("o que e lancado num mes a frente nao aparece antes dele", () => {
    const est = { dados: retrato(SET, [aluguel]), futuro: [plano(NOV, [academia])] };
    expect(nomes(itensNoMes(OUT, est))).toEqual(["Aluguel"]);
  });

  it("fixa lancada num mes a frente segue pelos meses seguintes; a vista, nao", () => {
    const est = { dados: retrato(SET, [aluguel]), futuro: [plano(OUT, [academia, ipva])] };
    expect(nomes(itensNoMes(DEZ, est))).toEqual(["Academia", "Aluguel"]);
  });

  it("parcela lancada num mes a frente conta a partir dele", () => {
    const tv = { id: "t", tipo: "parcelado", nome: "TV", valor: 200, paga: 1, total: 3 };
    const est = { dados: retrato(SET, []), futuro: [plano(OUT, [tv])] };
    expect(itensNoMes(OUT, est)[0].paga).toBe(1);
    expect(itensNoMes(DEZ, est)[0].paga).toBe(3);
    expect(itensNoMes({ mesBase: 0, anoBase: 2027 }, est)).toEqual([]);
  });

  it("marca como herdado so o que vem de outro mes", () => {
    const est = { dados: retrato(SET, [aluguel]), futuro: [plano(OUT, [ipva])] };
    const out = itensNoMes(OUT, est);
    expect(out.find((i) => i.nome === "Aluguel").herdado).toBe(true);
    expect(out.find((i) => i.nome === "IPVA").herdado).toBeUndefined();
  });

  it("no mes atual nada e herdado", () => {
    const est = { dados: retrato(SET, [aluguel, notebook]), futuro: [] };
    expect(itensNoMes(SET, est)).toEqual([aluguel, notebook]);
  });

  // Retrato a frente e o que sobra quando se volta com "abrir mes": outubro ja
  // foi vivido, entao vale o que esta gravado nele.
  it("um retrato a frente vale como esta, sem somar o mes atual", () => {
    const est = {
      dados: retrato(SET, [aluguel, notebook]),
      futuro: [retrato(OUT, [academia])],
    };
    expect(itensNoMes(OUT, est)).toEqual([academia]);
  });

  it("depois de um retrato, a projecao parte dele e nao do mes atual", () => {
    const est = {
      dados: retrato(SET, [aluguel, notebook]),
      futuro: [retrato(OUT, [academia]), plano(NOV, [ipva])],
    };
    expect(nomes(itensNoMes(NOV, est))).toEqual(["Academia", "IPVA"]);
    expect(nomes(itensNoMes(DEZ, est))).toEqual(["Academia"]);
  });

  it("plano que ficou antes de um retrato nao entra de novo depois dele", () => {
    const est = {
      dados: retrato(SET, [aluguel]),
      futuro: [plano(OUT, [academia]), retrato(NOV, [notebook])],
    };
    expect(nomes(itensNoMes(DEZ, est))).toEqual(["Notebook"]);
  });

  it("nao depende de futuro estar ordenado", () => {
    const est = {
      dados: retrato(SET, [aluguel]),
      futuro: [plano(NOV, [ipva]), plano(OUT, [academia])],
    };
    expect(nomes(itensNoMes(NOV, est))).toEqual(["Academia", "Aluguel", "IPVA"]);
  });

  it("nao muta os itens de origem", () => {
    const est = { dados: retrato(SET, [{ ...notebook }]), futuro: [] };
    itensNoMes(DEZ, est);
    expect(est.dados.itens[0]).toEqual(notebook);
  });
});

describe("projetarItens", () => {
  const fixo = { id: "f", tipo: "fixo", nome: "Aluguel", valor: 350 };
  const parc = { id: "p", tipo: "parcelado", nome: "Notebook", valor: 300, paga: 2, total: 10 };
  const vista = { id: "v", tipo: "parcelado", nome: "Mercado", valor: 250, paga: 1, total: 1 };

  it("n zero devolve tudo como esta", () => {
    expect(projetarItens([fixo, parc, vista], 0)).toEqual([fixo, parc, vista]);
  });

  it("avanca a parcela em n casas", () => {
    expect(projetarItens([parc], 3)[0].paga).toBe(5);
  });

  it("o fixo atravessa sem mudar", () => {
    expect(projetarItens([fixo], 5)).toEqual([fixo]);
  });

  it("deixa pra tras o que ja acabou", () => {
    // a compra a vista nao existe um mes a frente
    expect(projetarItens([fixo, vista], 1).map((i) => i.id)).toEqual(["f"]);
    // e a parcela de 2/10 acaba oito meses depois
    expect(projetarItens([parc], 8).map((i) => i.id)).toEqual(["p"]);
    expect(projetarItens([parc], 9)).toEqual([]);
  });

  it("nao muta os itens de origem", () => {
    const original = [{ ...parc }];
    projetarItens(original, 4);
    expect(original[0].paga).toBe(2);
  });
});
