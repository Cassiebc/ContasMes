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
  fechadoEm: m.fechado_em,
  itens: (m.lancamentos ?? []).map(paraItem),
});

const ordemCronologica = (a, b) => a.anoBase - b.anoBase || a.mesBase - b.mesBase;

// Lê o caderno inteiro e devolve na forma que a tela usa.
export async function carregar(userId) {
  const { data, error } = await supabase
    .from("meses")
    .select("id, ano, mes, atual, fechado_em, lancamentos(id, nome, valor, tipo, paga, total)")
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
    .select("id")
    .eq("user_id", userId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
};

// Cria o mês, se ainda não existir, e devolve o id. Procura antes de inserir
// pra não bater na constraint de mês único à toa — o banco recusaria, e o
// 409 apareceria no console como se algo tivesse dado errado.
async function garantirMes(userId, { mesBase, anoBase, atual = false }) {
  const existente = await buscarMes(userId, anoBase, mesBase);
  if (existente) return existente;

  const { data, error } = await supabase
    .from("meses")
    .insert({ user_id: userId, ano: anoBase, mes: mesBase, atual })
    .select("id")
    .single();

  if (error) {
    // Se duas abas criaram o mesmo mês ao mesmo tempo, o banco deixou só uma
    // passar — a outra usa a que venceu em vez de falhar.
    const criadoPorOutro = await buscarMes(userId, anoBase, mesBase);
    if (criadoPorOutro) return criadoPorOutro;
    throw error;
  }
  return data.id;
}

const paraLinha = (mesId, item) => ({
  mes_id: mesId,
  nome: item.nome,
  valor: item.valor,
  tipo: item.tipo,
  paga: item.tipo === "parcelado" ? item.paga : null,
  total: item.tipo === "parcelado" ? item.total : null,
});

export async function lancar(userId, mes, item) {
  const mesId = mes.id ?? (await garantirMes(userId, mes));
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
// mês seguinte, criando ele com os itens avançados se ainda não existir.
export async function fecharMesNoBanco(userId, mesAtual, itensDoProximo, proximo) {
  const { error: erroFecha } = await supabase
    .from("meses")
    .update({ fechado_em: new Date().toISOString(), atual: false })
    .eq("id", mesAtual.id);
  if (erroFecha) throw erroFecha;

  const jaExiste = proximo.id != null;
  const proximoId = jaExiste ? proximo.id : await garantirMes(userId, proximo);

  if (!jaExiste && itensDoProximo.length > 0) {
    const { error } = await supabase
      .from("lancamentos")
      .insert(itensDoProximo.map((it) => paraLinha(proximoId, it)));
    if (error) throw error;
  }

  const { error } = await supabase.from("meses").update({ atual: true }).eq("id", proximoId);
  if (error) throw error;
  return proximoId;
}

// Substitui o caderno inteiro (restaurar backup).
export async function substituirTudo(userId, { dados, historico = [], futuro = [] }) {
  const { error: erroApaga } = await supabase.from("meses").delete().eq("user_id", userId);
  if (erroApaga) throw erroApaga;
  await escreverMeses(userId, [
    ...historico.map((m) => ({ ...m, atual: false })),
    { ...dados, atual: true },
    ...futuro.map((m) => ({ ...m, atual: false })),
  ]);
}

// 23505 = chave duplicada. Numa escrita idempotente isso quer dizer "já
// estava lá", não erro: acontece quando duas abas (ou o efeito rodando duas
// vezes em desenvolvimento) fazem a mesma coisa ao mesmo tempo.
const DUPLICADO = "23505";

async function escreverMeses(userId, meses) {
  for (const m of meses) {
    if (!Number.isInteger(m?.mesBase) || !Number.isInteger(m?.anoBase)) continue;
    const mesId = await garantirMes(userId, m);
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
    ...historico.map((m) => ({ ...m, atual: false })),
    { ...antigo.dados, atual: true },
    ...futuro.map((m) => ({ ...m, atual: false })),
  ];

  // O formato antigo permitia o mesmo mês em mais de uma lista. Aqui só cabe
  // um: os lançamentos dos repetidos se juntam, em vez de um deles sumir.
  await escreverMeses(userId, lista);
  return { migrou: true, meses: lista.length };
}
