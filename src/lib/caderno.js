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

// Anda `n` meses a partir de (base, ano). `n` negativo volta no tempo.
//
// O resto é normalizado à mão porque o `%` do JavaScript devolve negativo
// para entrada negativa: em janeiro (base 0), um mês atrás daria índice -1 e
// `MESES[-1]` é undefined — o título viraria "undefined". Só aparece na
// virada do ano, que é justamente quando ninguém está olhando.
export const deslocarMes = (base, ano, n) => {
  const t = base + n;
  return {
    mesBase: ((t % 12) + 12) % 12,
    anoBase: ano + Math.floor(t / 12),
  };
};

export const rotuloMes = (base, ano, offset) => {
  const { mesBase, anoBase } = deslocarMes(base, ano, offset);
  return { nome: MESES[mesBase], ano: anoBase };
};

// Conta à vista: acontece uma vez, no mês em que foi lançada, e não aparece
// no seguinte. No banco ela é uma parcela única — "1 de 1" — e não um tipo
// novo, porque o modelo que já existe se comporta exatamente assim:
// `ativoEm` a deixa só no offset 0 e `fecharMes` a descarta ao virar o mês.
// Um tipo 'avista' pediria alterar o schema pra ganhar o mesmo resultado, e
// abriria um terceiro caminho em cada `if` que hoje só tem dois.
//
// Como o banco garante `paga >= 1` e `paga <= total`, total 1 já implica
// paga 1: não existe "0 de 1" nem "2 de 1".
export const ehAVista = (it) => it.tipo === "parcelado" && it.total === 1;

// Um mês à frente sem nenhum lançamento não é planejamento: "outubro
// planejado, vazio" e "outubro ainda não planejado" dizem a mesma coisa, e
// guardar o registro só atrapalha (zera a projeção daquele mês e, se for
// adotado num fechamento, apaga as contas fixas). Quem aplica isso ao ler e
// gravar é o repositório — aqui fica só a regra, pra poder ser testada
// sozinha.
export const ehPlanejamentoVazio = (mes) => !(mes?.itens?.length > 0);

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

export const mesmoMes = (a, b) => a.mesBase === b.mesBase && a.anoBase === b.anoBase;

// Quantos meses separam (a) de (b). Positivo quando b vem depois.
export const distanciaMeses = (a, b) =>
  (b.anoBase - a.anoBase) * 12 + (b.mesBase - a.mesBase);

// Em que passo da linha do tempo um mês aparece, dado o caderno lido.
//
// Para trás o passo é distância de calendário: um passo atrás é sempre o mês
// anterior, exista registro ou não. Foi isso que destravou quem tinha o mês
// atual adiantado — antes o passo contava registros, então quem não tinha
// histórico não tinha para onde voltar, e quem tinha um registro antigo
// pulava direto pra ele, deixando os meses do meio inalcançáveis.
//
// Para frente o passo continua contando registros planejados e depois a
// projeção, que é como o resto da tela já raciocina.
export const posDoMes = (alvo, { dados, historico, futuro }) => {
  const d = distanciaMeses(dados, alvo);
  if (d <= 0) return d;

  const iF = futuro.findIndex((m) => mesmoMes(m, alvo));
  if (iF >= 0) return iF + 1;

  const ultimo = futuro.length > 0 ? futuro[futuro.length - 1] : dados;
  return futuro.length + distanciaMeses(ultimo, alvo);
};
