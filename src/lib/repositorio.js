import { supabase } from "../supabase";
import { novoCaderno, ehPlanejamentoVazio } from "./caderno";

// Acesso ao caderno nas tabelas `meses` e `lancamentos`.
//
// O formato antigo guardava o caderno inteiro num jsonb e reescrevia tudo a
// cada alteração, com três listas (histórico / atual / futuro) que o código
// tinha de manter em ordem sozinho. Aqui a linha do tempo é só a ordem
// natural de (ano, mes), e "fechado / atual / planejado" sai da comparação
// com o mês marcado como atual — não dá pra um mês fechado aparecer depois
// do atual, nem o mesmo mês existir duas vezes.

const paraItem = (l) => ({
  id: l.id,
  nome: l.nome,
  valor: Number(l.valor),
  tipo: l.tipo,
  ...(l.tipo === "parcelado" ? { paga: l.paga, total: l.total } : {}),
});

const paraMes = (m) => ({
  id: m.id,
  mesBase: m.mes,
  anoBase: m.ano,
  atual: m.atual,
  planejado: m.planejado === true,
  fechadoEm: m.fechado_em,
  itens: (m.lancamentos ?? []).map(paraItem),
});

const ordemCronologica = (a, b) => a.anoBase - b.anoBase || a.mesBase - b.mesBase;

// Lê o caderno inteiro e devolve na forma que a tela usa.
export async function carregar(userId) {
  const { data, error } = await supabase
    .from("meses")
    .select("id, ano, mes, atual, planejado, fechado_em, lancamentos(id, nome, valor, tipo, paga, total)")
    .eq("user_id", userId)
    .order("ano")
    .order("mes");

  if (error) throw error;

  const meses = (data ?? []).map(paraMes).sort(ordemCronologica);
  const atual = meses.find((m) => m.atual) ?? null;
  if (!atual) return { meses, dados: null, historico: [], futuro: [] };

  // Um mês à frente sem lançamento nenhum não é planejamento — "outubro
  // planejado, vazio" e "outubro ainda não planejado" dizem a mesma coisa.
  // Manter o registro zeraria a projeção daquele mês e, ao ser adotado num
  // fechamento, apagaria as contas fixas. Some com ele aqui e limpa o banco.
  //
  // Mês fechado vazio fica: "nesse mês não tive contas" é informação de
  // verdade. E o mês atual sempre fica, mesmo sem lançamento.
  const futuroVazio = meses.filter(
    (m) => ordemCronologica(m, atual) > 0 && ehPlanejamentoVazio(m)
  );
  if (futuroVazio.length > 0) {
    await supabase.from("meses").delete().in("id", futuroVazio.map((m) => m.id));
  }
  const vazios = new Set(futuroVazio.map((m) => m.id));
  const validos = meses.filter((m) => !vazios.has(m.id));

  return {
    meses: validos,
    dados: atual,
    historico: validos.filter((m) => ordemCronologica(m, atual) < 0),
    futuro: validos.filter((m) => ordemCronologica(m, atual) > 0),
  };
}

const buscarMes = async (userId, ano, mes) => {
  const { data, error } = await supabase
    .from("meses")
    .select("id, planejado")
    .eq("user_id", userId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
};

// Cria o mês, se ainda não existir, e devolve o id. Procura antes de inserir
// pra não bater na constraint de mês único à toa — o banco recusaria, e o
// 409 apareceria no console como se algo tivesse dado errado.
//
// `criado` diz se foi ESTA chamada que fez o mês nascer, e quem responde é o
// banco. Antes cada operação deduzia isso do que a tela sabia ("não tem id,
// então é novo"), e a tela pode estar atrasada: um toque duplo, ou o app
// aberto em outro aparelho, e as duas chamadas se achavam a criadora — cada
// uma despejava as contas do mês inteiro, e ele nascia duplicado.
//
// `planejado` volta como está no banco, pelo mesmo motivo: é ele que decide se
// um fechamento soma as contas ao mês ou o adota como está.
async function garantirMes(userId, { mesBase, anoBase, atual = false, planejado = false }) {
  const existente = await buscarMes(userId, anoBase, mesBase);
  if (existente) return { ...existente, criado: false };

  const { data, error } = await supabase
    .from("meses")
    .insert({ user_id: userId, ano: anoBase, mes: mesBase, atual, planejado })
    .select("id")
    .single();

  if (error) {
    // Se duas abas criaram o mesmo mês ao mesmo tempo, o banco deixou só uma
    // passar — a outra usa a que venceu em vez de falhar.
    const criadoPorOutro = await buscarMes(userId, anoBase, mesBase);
    if (criadoPorOutro) return { ...criadoPorOutro, criado: false };
    throw error;
  }
  return { id: data.id, planejado, criado: true };
}

const paraLinha = (mesId, item) => ({
  mes_id: mesId,
  nome: item.nome,
  valor: item.valor,
  tipo: item.tipo,
  paga: item.tipo === "parcelado" ? item.paga : null,
  total: item.tipo === "parcelado" ? item.total : null,
});

// Lança no mês pedido, criando-o se ainda não existir. Um mês à frente nasce
// como plano (`mes.planejado`) e guarda só este lançamento — o resto do mês
// continua sendo calculado, veja `itensNoMes`.
export async function lancar(userId, mes, item) {
  const mesId = mes.id ?? (await garantirMes(userId, mes)).id;
  const { error } = await supabase.from("lancamentos").insert(paraLinha(mesId, item));
  if (error) throw error;
}

export async function editarLancamento(id, item) {
  const { error } = await supabase
    .from("lancamentos")
    .update({
      nome: item.nome,
      valor: item.valor,
      tipo: item.tipo,
      paga: item.tipo === "parcelado" ? item.paga : null,
      total: item.tipo === "parcelado" ? item.total : null,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function removerLancamento(id) {
  const { error } = await supabase.from("lancamentos").delete().eq("id", id);
  if (error) throw error;
}

export async function apagarMes(mesId) {
  // Os lançamentos saem junto (on delete cascade).
  const { error } = await supabase.from("meses").delete().eq("id", mesId);
  if (error) throw error;
}

// Muda qual mês é o atual. É isto que "abrir mês" faz agora: nada é movido
// de lista nenhuma, só troca a marca — o resto da linha do tempo se
// reorganiza sozinho pela ordem das datas.
//
// Torna atual um mês que pode ainda não existir — é o caso de quem voltou
// pra um mês que nunca registrou. Cria a linha antes de marcar.
//
// Abrir um mês À FRENTE pede um passo a mais. O mês atual é sempre retrato, e
// um plano só guarda o que foi lançado nele: marcá-lo como atual do jeito que
// está deixaria o mês só com o IPVA, sem as contas fixas. `completar` traz, pra
// cada mês que vai deixar de ser plano, as contas que ele herdava — o alvo e
// os planos que ficam pra trás dele, que senão virariam histórico pela metade.
// Só completa o que ainda é plano no banco: se outro aparelho já fez isso, não
// soma de novo.
export async function abrirMesNoBanco(userId, mes, completar = []) {
  for (const { mes: m, itens } of completar) {
    const { id, criado, planejado } = await garantirMes(userId, {
      mesBase: m.mesBase,
      anoBase: m.anoBase,
    });
    if (criado || planejado) await virarRetrato(id, itens);
  }
  const mesId = mes.id ?? (await garantirMes(userId, mes)).id;
  await definirAtual(userId, mesId);
}

// Soma as contas herdadas a um mês e tira dele a marca de plano. Devolve os
// ids do que entrou, pra quem chamou poder desfazer.
async function virarRetrato(mesId, itens) {
  let entraram = [];
  if (itens.length > 0) {
    const { data, error } = await supabase
      .from("lancamentos")
      .insert(itens.map((it) => paraLinha(mesId, it)))
      .select("id");
    if (error) throw error;
    entraram = (data ?? []).map((l) => l.id);
  }
  const { error } = await supabase.from("meses").update({ planejado: false }).eq("id", mesId);
  if (error) throw error;
  return entraram;
}

export async function definirAtual(userId, mesId) {
  const { error: erroLimpa } = await supabase
    .from("meses")
    .update({ atual: false })
    .eq("user_id", userId)
    .eq("atual", true);
  if (erroLimpa) throw erroLimpa;

  const { error } = await supabase.from("meses").update({ atual: true }).eq("id", mesId);
  if (error) throw error;
}

// Fecha o mês atual: marca a data de fechamento e passa a marca de atual pro
// mês seguinte, que recebe as contas com as parcelas avançadas.
//
// O mês seguinte pode estar em três estados, e quem diz qual é o banco:
// - não existe: é criado com as contas avançadas;
// - é um plano: as contas avançadas se somam ao que já estava lançado nele;
// - é um retrato (já foi vivido, e alguém voltou com "abrir mês"): é adotado
//   como está, sem somar nada.
//
// O primeiro passo só vale se o mês ainda for o atual NO BANCO. Quem chega
// depois — o segundo toque no botão, ou outro aparelho com a tela atrasada —
// não fecha nada e sai sem escrever. Sem essa trava as duas chamadas seguiam
// até o fim e o mês seguinte recebia as contas duas vezes.
export async function fecharMesNoBanco(userId, mesAtual, itensDoProximo, proximo) {
  const { data: fechados, error: erroFecha } = await supabase
    .from("meses")
    .update({ fechado_em: new Date().toISOString(), atual: false })
    .eq("id", mesAtual.id)
    .eq("atual", true)
    .select("id");
  if (erroFecha) throw erroFecha;
  if (!fechados?.length) return null;

  let entraram = [];
  let eraPlano = null;
  try {
    const { id: proximoId, criado, planejado } = await garantirMes(userId, {
      mesBase: proximo.mesBase,
      anoBase: proximo.anoBase,
    });
    if (criado || planejado) {
      if (planejado) eraPlano = proximoId;
      entraram = await virarRetrato(proximoId, itensDoProximo);
    }

    const { error } = await supabase.from("meses").update({ atual: true }).eq("id", proximoId);
    if (error) throw error;
    return proximoId;
  } catch (e) {
    // Falhou no meio: desfaz o que entrou e devolve a marca de atual, senão o
    // caderno fica sem mês atual nenhum e nem abre mais.
    if (entraram.length > 0) await supabase.from("lancamentos").delete().in("id", entraram);
    if (eraPlano) await supabase.from("meses").update({ planejado: true }).eq("id", eraPlano);
    await supabase
      .from("meses")
      .update({ atual: true, fechado_em: mesAtual.fechadoEm ?? null })
      .eq("id", mesAtual.id);
    throw e;
  }
}

// Substitui o caderno inteiro (restaurar backup).
export async function substituirTudo(userId, { dados, historico = [], futuro = [] }) {
  const { error: erroApaga } = await supabase.from("meses").delete().eq("user_id", userId);
  if (erroApaga) throw erroApaga;
  await escreverMeses(userId, [
    ...historico.map((m) => ({ ...m, atual: false, planejado: false })),
    { ...dados, atual: true, planejado: false },
    // Só mês à frente pode ser plano. Backup antigo não traz a marca, e lá o
    // mês à frente era o mês inteiro — retrato, que é o padrão.
    ...futuro.map((m) => ({ ...m, atual: false, planejado: m.planejado === true })),
  ]);
}

// 23505 = chave duplicada. Numa escrita idempotente isso quer dizer "já
// estava lá", não erro: acontece quando duas abas (ou o efeito rodando duas
// vezes em desenvolvimento) fazem a mesma coisa ao mesmo tempo.
const DUPLICADO = "23505";

async function escreverMeses(userId, meses) {
  for (const m of meses) {
    if (!Number.isInteger(m?.mesBase) || !Number.isInteger(m?.anoBase)) continue;
    const { id: mesId } = await garantirMes(userId, m);
    if (m.atual) await supabase.from("meses").update({ atual: true }).eq("id", mesId);
    if (m.fechadoEm) await supabase.from("meses").update({ fechado_em: m.fechadoEm }).eq("id", mesId);

    const itens = (m.itens ?? []).filter((it) => it?.nome?.trim() && it.valor > 0);
    if (itens.length === 0) continue;
    const { error } = await supabase.from("lancamentos").insert(
      itens.map((it) => ({
        ...paraLinha(mesId, {
          ...it,
          nome: it.nome.trim(),
          paga: Math.max(1, it.paga ?? 1),
          total: Math.max(Math.max(1, it.paga ?? 1), it.total ?? 1),
        }),
        origem_id: it.id ?? null,
      }))
    );
    if (error && error.code !== DUPLICADO) throw error;
  }
}

// Migrar duas vezes ao mesmo tempo faz as duas execuções disputarem os
// mesmos registros. Quem chegar depois espera a que já está em andamento em
// vez de começar outra — o React chama o efeito duas vezes em
// desenvolvimento, e é o que acontece também se o app abrir em duas abas.
let migracaoEmAndamento = null;

export function migrarDoFormatoAntigo(userId) {
  if (!migracaoEmAndamento) {
    migracaoEmAndamento = migrar(userId).finally(() => {
      migracaoEmAndamento = null;
    });
  }
  return migracaoEmAndamento;
}

// Traz o caderno do formato antigo pro novo, uma vez por pessoa. Roda quando
// ainda não existe nenhum mês nas tabelas novas; se algo falhar no meio, a
// tabela `cadernos` continua intacta e dá pra tentar de novo.
async function migrar(userId) {
  const { count, error: erroConta } = await supabase
    .from("meses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (erroConta) throw erroConta;
  if ((count ?? 0) > 0) return { migrou: false, motivo: "já tem dados no formato novo" };

  const { data: antigo, error } = await supabase
    .from("cadernos")
    .select("dados, historico, futuro")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;

  const inicial = { ...novoCaderno(), atual: true };
  if (!antigo?.dados) {
    await escreverMeses(userId, [inicial]);
    return { migrou: true, meses: 1, novo: true };
  }

  const historico = Array.isArray(antigo.historico) ? antigo.historico : [];
  const futuro = Array.isArray(antigo.futuro) ? antigo.futuro : [];
  const lista = [
    ...historico.map((m) => ({ ...m, atual: false, planejado: false })),
    { ...antigo.dados, atual: true, planejado: false },
    ...futuro.map((m) => ({ ...m, atual: false, planejado: false })),
  ];

  // O formato antigo permitia o mesmo mês em mais de uma lista. Aqui só cabe
  // um: os lançamentos dos repetidos se juntam, em vez de um deles sumir.
  await escreverMeses(userId, lista);
  return { migrou: true, meses: lista.length };
}
