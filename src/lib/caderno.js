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

// De onde a projeção de um mês parte: o último mês que EXISTE antes dele —
// o planejado mais recente, ou o mês atual quando não há planejamento no meio.
//
// É o que faz planejar dezembro continuar propagando pra janeiro sem que
// planejar dezembro apague novembro da conta. Antes a projeção partia sempre
// do último planejado da lista, então um planejamento distante engolia todos
// os meses entre ele e o atual.
//
// Não depende de `futuro` estar ordenado: percorre todos e fica com o mais
// tardio que ainda vem antes do alvo.
export const baseDaProjecao = (alvo, { dados, futuro }) =>
  futuro
    .filter((m) => distanciaMeses(m, alvo) > 0)
    .reduce((mais, m) => (distanciaMeses(mais, m) > 0 ? m : mais), dados);

// Os itens como ficam `n` meses à frente: as parcelas já na casa certa e as
// que acabaram fora. É `fecharMes` aplicado n vezes, de uma vez só.
//
// Serve pra materializar um mês planejado. Quando se lança uma conta num mês
// à frente que ainda não existia, ele nasce com a projeção dentro, não só com
// a conta nova — um novembro guardando só o IPVA valeria menos que outubro na
// projeção e, ao ser adotado num fechamento, levaria as contas fixas embora.
export const projetarItens = (itens, n) =>
  itens
    .filter((it) => ativoEm(it, n))
    .map((it) => (it.tipo === "fixo" ? it : { ...it, paga: it.paga + n }));

export const mesmoMes = (a, b) => a.mesBase === b.mesBase && a.anoBase === b.anoBase;

// Quantos meses separam (a) de (b). Positivo quando b vem depois.
export const distanciaMeses = (a, b) =>
  (b.anoBase - a.anoBase) * 12 + (b.mesBase - a.mesBase);

// Em que passo da linha do tempo um mês aparece, dado o caderno lido.
//
// É distância de calendário nos dois sentidos: um passo é sempre um mês do
// calendário, exista registro ou não. A posição de novembro não muda quando
// novembro passa a existir, nem quando outubro deixa de existir.
//
// Contar registros já foi o jeito dos dois lados, e nos dois deu o mesmo bug.
// Pra trás, deixava sem saída quem tinha o mês atual adiantado e nenhum
// histórico, e tornava inalcançáveis os meses entre o atual e um registro
// antigo. Pra frente era igual: quem planejasse novembro sem planejar outubro
// perdia outubro da linha do tempo. Calendário nos dois lados resolve os dois,
// e é por isso que esta função não olha mais `historico` nem `futuro`.
export const posDoMes = (alvo, { dados }) => distanciaMeses(dados, alvo);
