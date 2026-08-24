// Fala com o Supabase por HTTP direto, sem passar pela tela. É assim que os
// testes conferem o que REALMENTE foi para o banco depois de cada passo —
// olhar só a interface esconderia justamente os bugs de consistência.

import { SUPABASE_URL as URL, SUPABASE_KEY as KEY, EMAIL, SENHA } from './ambiente.mjs';

export async function login() {
  const r = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  });
  const j = await r.json();
  return { token: j.access_token, uid: j.user.id };
}

const h = (token) => ({ apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });

// Le do modelo NOVO (meses + lancamentos) e devolve no formato que os
// testes ja usam: { dados, historico, futuro }.
export async function ler(token) {
  const r = await fetch(
    `${URL}/rest/v1/meses?select=id,ano,mes,atual,fechado_em,lancamentos(id,nome,valor,tipo,paga,total)&order=ano,mes`,
    { headers: h(token) });
  const linhas = await r.json();
  const meses = linhas.map((m) => ({
    id: m.id, mesBase: m.mes, anoBase: m.ano, atual: m.atual,
    itens: (m.lancamentos ?? []).map((l) => ({
      id: l.id, nome: l.nome, valor: Number(l.valor), tipo: l.tipo,
      ...(l.tipo === 'parcelado' ? { paga: l.paga, total: l.total } : {}),
    })),
  }));
  const cmp = (a, b) => a.anoBase - b.anoBase || a.mesBase - b.mesBase;
  const dados = meses.find((m) => m.atual) ?? null;
  return {
    dados,
    historico: dados ? meses.filter((m) => cmp(m, dados) < 0) : [],
    futuro: dados ? meses.filter((m) => cmp(m, dados) > 0) : [],
  };
}

// Zera e cria agosto/2026 vazio como mes atual.
export async function resetar(token, uid) {
  await fetch(`${URL}/rest/v1/meses?user_id=eq.${uid}`, { method: 'DELETE', headers: h(token) });
  const r = await fetch(`${URL}/rest/v1/meses`, {
    method: 'POST', headers: { ...h(token), Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: uid, ano: 2026, mes: 7, atual: true }),
  });
  return r.status;
}

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const rot = (r) => r ? `${MESES[r.mesBase]}/${String(r.anoBase).slice(2)}` : '—';
const soma = (r) => r ? r.itens.reduce((s, i) => s + i.valor, 0) : 0;

export function resumir(e, titulo) {
  console.log(`\n--- ${titulo} ---`);
  console.log(`  historico: [${e.historico.map((h) => `${rot(h)}(${soma(h)})`).join(', ')}]`);
  console.log(`  ATUAL:      ${rot(e.dados)}(${soma(e.dados)})`);
  console.log(`  futuro:    [${e.futuro.map((f) => `${rot(f)}(${soma(f)})`).join(', ')}]`);
}
