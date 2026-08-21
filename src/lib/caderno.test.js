import { describe, it, expect } from "vitest";
import { faltam, ativoEm, rotuloMes, fecharMes } from "./caderno";

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
