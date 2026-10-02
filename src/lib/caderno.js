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

// Os itens como ficam `n` meses à frente: as parcelas já na casa certa e as
// que acabaram fora. É `fecharMes` aplicado n vezes, de uma vez só.
export const projetarItens = (itens, n) =>
  itens
    .filter((it) => ativoEm(it, n))
    .map((it) => (it.tipo === "fixo" ? it : { ...it, paga: it.paga + n }));

// O que cai num mês à frente do atual.
//
// Um mês à frente pode ser duas coisas, e a coluna `planejado` é quem diz:
//
// - PLANO (`planejado: true`): guarda só o que foi lançado nele — o IPVA de
//   novembro. Não é o mês inteiro. O resto continua vindo do mês atual, então
//   uma conta nova em setembro aparece em novembro mesmo com novembro já
//   planejado. E o que nasce no plano segue adiante: uma fixa lançada em
//   novembro está em dezembro também.
// - RETRATO (`planejado: false`): o mês inteiro, gravado. É o mês atual, e é o
//   que sobra à frente quando se volta com "abrir mês" — outubro já vivido
//   não é recalculado só porque setembro voltou a ser o atual.
//
// A conta parte do último retrato que existe até o mês pedido e soma os planos
// dali em diante, cada item já na parcela daquele mês. O que vem de outro mês
// sai marcado `herdado`: a tela mostra, mas só deixa mexer no mês de origem.
//
// O plano já foi retrato também: lançar em outubro gravava ali uma cópia de
// setembro inteiro. A cópia parava no tempo — o que entrasse em setembro
// depois não chegava a outubro nem a mês nenhum adiante — e era ela que
// dobrava quando duas escritas se cruzavam.
export const itensNoMes = (alvo, { dados, futuro }) => {
  const ate = [dados, ...futuro].filter((m) => distanciaMeses(m, alvo) >= 0);
  const base = ate
    .filter((m) => !m.planejado)
    .reduce((mais, m) => (distanciaMeses(mais, m) > 0 ? m : mais), dados);
  return ate
    .filter((m) => m === base || (m.planejado && distanciaMeses(base, m) > 0))
    .flatMap((m) => {
      const n = distanciaMeses(m, alvo);
      return projetarItens(m.itens, n).map((it) => (n > 0 ? { ...it, herdado: true } : it));
    });
};

// O que "abrir mês" precisa gravar antes de marcar um mês à frente como atual.
//
// O mês atual é sempre retrato, e um plano só guarda o que foi lançado nele:
// marcá-lo como atual do jeito que está abriria o mês só com o IPVA, sem as
// contas fixas. Então cada mês que deixa de ser plano — o alvo e os planos que
// ficam pra trás dele, que senão virariam histórico pela metade — recebe as
// contas que herdava. Pra trás, ou pra um retrato, a lista sai vazia.
export const completarAoAbrir = (alvo, { dados, futuro }) =>
  [
    ...futuro.filter((m) => m.planejado && distanciaMeses(m, alvo) > 0),
    ...(alvo.planejado ? [alvo] : []),
  ].map((mes) => ({
    mes,
    itens: itensNoMes(mes, { dados, futuro }).filter((it) => it.herdado),
  }));

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
