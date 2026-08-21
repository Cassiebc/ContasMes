export const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

// Caderno em branco, ancorado no mês em que a conta foi criada.
export const novoCaderno = () => {
  const hoje = new Date();
  return {
    mesBase: hoje.getMonth(), // 0 = janeiro
    anoBase: hoje.getFullYear(),
    itens: [],
  };
};

export const brl = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Quantas parcelas ainda faltam depois do mês base
export const faltam = (it) => (it.tipo === "fixo" ? Infinity : it.total - it.paga);

// O item aparece no mês `offset` (0 = mês base)?
export const ativoEm = (it, offset) => {
  if (it.tipo === "fixo") return true;
  if (offset === 0) return true;
  return faltam(it) >= offset;
};

export const rotuloMes = (base, ano, offset) => {
  const i = (base + offset) % 12;
  const a = ano + Math.floor((base + offset) / 12);
  return { nome: MESES[i], ano: a };
};

// Avança todas as parcelas em 1, remove as que chegaram ao fim e vira o mês base.
export const fecharMes = ({ itens, mesBase, anoBase }) => {
  const novosItens = itens
    .map((it) => (it.tipo === "fixo" ? it : { ...it, paga: it.paga + 1 }))
    .filter((it) => it.tipo === "fixo" || it.paga <= it.total);
  return {
    itens: novosItens,
    mesBase: (mesBase + 1) % 12,
    anoBase: anoBase + (mesBase === 11 ? 1 : 0),
  };
};
