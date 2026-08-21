import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Login from "./Login.jsx";
import { MESES, novoCaderno, ativoEm, faltam, rotuloMes, fecharMes } from "./lib/caderno";
import { useTema } from "./lib/tema.js";
import AbaMes from "./components/AbaMes.jsx";
import AbaProjecao from "./components/AbaProjecao.jsx";
import AbaHistorico from "./components/AbaHistorico.jsx";
import AbaMesHistorico from "./components/AbaMesHistorico.jsx";
import ModalFecharMes from "./components/ModalFecharMes.jsx";
import ModalAbrirMes from "./components/ModalAbrirMes.jsx";
import FormConta from "./components/FormConta.jsx";
import BotaoTema from "./components/BotaoTema.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [checando, setChecando] = useState(true);
  const [tema, alternarTema] = useTema();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (checando) return <Abrindo />;
  if (!session) return <Login tema={tema} onAlternarTema={alternarTema} />;
  return <CadernoContas session={session} tema={tema} onAlternarTema={alternarTema} key={session.user.id} />;
}

function Abrindo() {
  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-900 flex items-center justify-center">
      <p className="text-stone-500 dark:text-stone-400 text-sm tracking-widest uppercase">
        abrindo o caderno
      </p>
    </div>
  );
}

function CadernoContas({ session, tema, onAlternarTema }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [aba, setAba] = useState("mes");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState(null);
  const [confirmarFechar, setConfirmarFechar] = useState(false);
  const [confirmarAbrir, setConfirmarAbrir] = useState(false);
  const [historico, setHistorico] = useState([]);
  const [futuro, setFuturo] = useState([]);
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const { data, error } = await supabase
        .from("cadernos")
        .select("dados, dados_anterior, historico, futuro")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!vivo) return;
      if (error) {
        setErro("Não deu para carregar seus dados. Verifique a conexão.");
        setDados(null);
      } else if (data) {
        setDados(data.dados);
        // Migra o snapshot único do formato antigo (dados_anterior) pra
        // dentro do histórico, se ainda não tiver sido migrado.
        const hist = Array.isArray(data.historico) ? data.historico : [];
        setHistorico(
          hist.length === 0 && data.dados_anterior
            ? [{ ...data.dados_anterior, fechadoEm: null }]
            : hist
        );
        setFuturo(Array.isArray(data.futuro) ? data.futuro : []);
      } else {
        // Primeiro acesso: cria um caderno vazio no mês corrente.
        const inicial = novoCaderno();
        await supabase.from("cadernos").insert({ user_id: session.user.id, dados: inicial });
        setDados(inicial);
      }
      setCarregando(false);
    })();
    return () => { vivo = false; };
  }, [session.user.id]);

  useEffect(() => {
    if (!salvo) return;
    const t = setTimeout(() => setSalvo(false), 2000);
    return () => clearTimeout(t);
  }, [salvo]);

  // `extra` permite incluir outras colunas no mesmo upsert (ex.: historico),
  // sem afetá-las quando omitido — o upsert só sobrescreve as colunas enviadas.
  const salvar = async (novo, extra = {}) => {
    const anterior = dados;
    setDados(novo);
    setSalvando(true);
    setSalvo(false);
    const { error } = await supabase
      .from("cadernos")
      .upsert({ user_id: session.user.id, dados: novo, updated_at: new Date().toISOString(), ...extra });
    setSalvando(false);
    if (error) {
      setDados(anterior);
      setErro("Não deu para salvar. A alteração foi desfeita — tente de novo.");
      return false;
    }
    setErro(null);
    setSalvo(true);
    return true;
  };

  // Edita só a coluna historico, sem tocar em dados (o mês atual). Usado
  // pra lançar/editar/remover itens de um mês já fechado, sem afetar nada
  // dos meses entre ele e o atual.
  const salvarHistorico = async (novoHistorico) => {
    const anterior = historico;
    setHistorico(novoHistorico);
    setSalvando(true);
    setSalvo(false);
    const { error } = await supabase
      .from("cadernos")
      .update({ historico: novoHistorico, updated_at: new Date().toISOString() })
      .eq("user_id", session.user.id);
    setSalvando(false);
    if (error) {
      setHistorico(anterior);
      setErro("Não deu para salvar. A alteração foi desfeita — tente de novo.");
      return false;
    }
    setErro(null);
    setSalvo(true);
    return true;
  };

  // Espelho de salvarHistorico pra coluna futuro.
  const salvarFuturo = async (novoFuturo) => {
    const anterior = futuro;
    setFuturo(novoFuturo);
    setSalvando(true);
    setSalvo(false);
    const { error } = await supabase
      .from("cadernos")
      .update({ futuro: novoFuturo, updated_at: new Date().toISOString() })
      .eq("user_id", session.user.id);
    setSalvando(false);
    if (error) {
      setFuturo(anterior);
      setErro("Não deu para salvar. A alteração foi desfeita — tente de novo.");
      return false;
    }
    setErro(null);
    setSalvo(true);
    return true;
  };

  if (carregando) return <Abrindo />;

  if (!dados) {
    return (
      <div className="min-h-screen bg-stone-100 dark:bg-stone-900 dark:text-stone-100 flex items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <p className="text-sm mb-4">
            {erro || "Não deu para carregar seus dados."}
          </p>
          <button onClick={() => window.location.reload()}
            className="border border-stone-400 dark:border-stone-600 px-5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
            tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const { itens, mesBase, anoBase } = dados;

  // Linha do tempo, do passado pro futuro:
  //   offset < 0                     → historico (mês fechado, congelado)
  //   offset === 0                   → dados (o mês atual, editável de verdade)
  //   0 < offset <= futuro.length    → futuro (mês planejado, congelado)
  //   offset > futuro.length         → projeção calculada (sem registro próprio)
  const emHistorico = offset < 0;
  const idxHistorico = emHistorico ? offset + historico.length : null;
  const entryHistorico = emHistorico ? historico[idxHistorico] : null;

  const emFuturo = offset > 0 && offset <= futuro.length;
  const idxFuturo = emFuturo ? offset - 1 : null;
  const entryFuturo = emFuturo ? futuro[idxFuturo] : null;

  // Registro concreto pra um offset >= 0 (dados ou uma entrada de futuro),
  // ou null se cair na zona de projeção calculada (sem registro próprio).
  const baseFuturo = futuro.length > 0 ? futuro[futuro.length - 1] : dados;
  const registroEm = (o) => {
    if (o === 0) return dados;
    if (o > 0 && o <= futuro.length) return futuro[o - 1];
    return null;
  };
  const itensEm = (o) => {
    const reg = registroEm(o);
    if (reg) return reg.itens;
    return baseFuturo.itens.filter((it) => ativoEm(it, o - futuro.length));
  };
  const fixosEm = (o) => itensEm(o).filter((i) => i.tipo === "fixo").reduce((s, i) => s + i.valor, 0);
  const parceladoEm = (o) => itensEm(o).filter((i) => i.tipo === "parcelado").reduce((s, i) => s + i.valor, 0);
  const totalEm = (o) => fixosEm(o) + parceladoEm(o);
  const rotuloEm = (o) => {
    const reg = registroEm(o);
    if (reg) return { nome: MESES[reg.mesBase], ano: reg.anoBase };
    return rotuloMes(baseFuturo.mesBase, baseFuturo.anoBase, o - futuro.length);
  };
  const encerramEm = (o) => {
    const reg = registroEm(o);
    if (reg) return reg.itens.filter((i) => i.tipo === "parcelado" && i.paga === i.total);
    const offsetRel = o - futuro.length;
    return baseFuturo.itens.filter(
      (i) => i.tipo === "parcelado" && ativoEm(i, offsetRel) && !ativoEm(i, offsetRel + 1)
    );
  };

  const horizonteComputado = Math.max(
    3,
    ...baseFuturo.itens.filter((i) => i.tipo === "parcelado").map((i) => faltam(i))
  );
  const meses = Array.from(
    { length: Math.min(futuro.length + horizonteComputado + 1, 13) },
    (_, i) => i
  );

  const remover = (id) => salvar({ ...dados, itens: itens.filter((i) => i.id !== id) });

  const removerHistorico = (idx, id) => {
    const novoHistorico = historico.map((h, i) =>
      i === idx ? { ...h, itens: h.itens.filter((it) => it.id !== id) } : h
    );
    salvarHistorico(novoHistorico);
  };

  const removerFuturo = (idx, id) => {
    const novoFuturo = futuro.map((f, i) =>
      i === idx ? { ...f, itens: f.itens.filter((it) => it.id !== id) } : f
    );
    salvarFuturo(novoFuturo);
  };

  const gravarForm = () => {
    const nome = (form.nome || "").trim();
    const valor = parseFloat(String(form.valor).replace(",", "."));
    if (!nome || !valor || valor <= 0) return;
    const novo = {
      id: form.id || String(Date.now()),
      nome,
      valor,
      tipo: form.tipo,
      ...(form.tipo === "parcelado"
        ? {
            paga: Math.max(1, parseInt(form.paga) || 1),
            total: Math.max(1, parseInt(form.total) || 1),
          }
        : {}),
    };

    if (emHistorico) {
      const novoHistorico = historico.map((h, i) => {
        if (i !== idxHistorico) return h;
        const lista = form.id
          ? h.itens.map((it) => (it.id === form.id ? novo : it))
          : [...h.itens, novo];
        return { ...h, itens: lista };
      });
      salvarHistorico(novoHistorico);
    } else if (emFuturo) {
      const novoFuturo = futuro.map((f, i) => {
        if (i !== idxFuturo) return f;
        const lista = form.id
          ? f.itens.map((it) => (it.id === form.id ? novo : it))
          : [...f.itens, novo];
        return { ...f, itens: lista };
      });
      salvarFuturo(novoFuturo);
    } else {
      const lista = form.id
        ? itens.map((i) => (i.id === form.id ? novo : i))
        : [...itens, novo];
      salvar({ ...dados, itens: lista });
    }
    setForm(null);
  };

  const virarMes = async () => {
    const novoHistorico = [
      ...historico,
      { mesBase, anoBase, itens, fechadoEm: new Date().toISOString() },
    ];
    if (futuro.length > 0) {
      const [proximo, ...restoFuturo] = futuro;
      const ok = await salvar(proximo, { historico: novoHistorico, futuro: restoFuturo });
      if (ok) { setHistorico(novoHistorico); setFuturo(restoFuturo); }
    } else {
      const ok = await salvar({ ...dados, ...fecharMes(dados) }, { historico: novoHistorico });
      if (ok) setHistorico(novoHistorico);
    }
    setOffset(0);
    setConfirmarFechar(false);
  };

  // Torna o mês visto agora o mês atual. Tudo que ficava entre ele e o mês
  // atual antigo (e o próprio mês atual antigo) vira "futuro planejado" —
  // nada é descartado, só reordenado.
  const abrirMes = async () => {
    let novoDados, novoHistorico, novoFuturo;
    if (emHistorico) {
      novoDados = historico[idxHistorico];
      novoHistorico = historico.slice(0, idxHistorico);
      novoFuturo = [...historico.slice(idxHistorico + 1), dados, ...futuro];
    } else if (emFuturo) {
      novoDados = futuro[idxFuturo];
      novoFuturo = futuro.slice(idxFuturo + 1);
      novoHistorico = [...historico, dados, ...futuro.slice(0, idxFuturo)];
    } else {
      return;
    }
    const ok = await salvar(novoDados, { historico: novoHistorico, futuro: novoFuturo });
    if (ok) { setHistorico(novoHistorico); setFuturo(novoFuturo); }
    setOffset(0);
    setConfirmarAbrir(false);
  };

  const exportar = () => {
    const blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caderno-${MESES[mesBase]}-${anoBase}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Excel em PT-BR espera ; como separador e , como decimal — usar , como
  // delimitador junto de valores com vírgula decimal quebraria a leitura.
  const exportarCsv = () => {
    const campo = (v) => {
      const s = String(v ?? "");
      return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const linhas = [["nome", "tipo", "valor", "parcela atual", "total de parcelas"]];
    for (const it of itens) {
      linhas.push([
        it.nome,
        it.tipo,
        String(it.valor).replace(".", ","),
        it.tipo === "parcelado" ? it.paga : "",
        it.tipo === "parcelado" ? it.total : "",
      ]);
    }
    const csv = linhas.map((l) => l.map(campo).join(";")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `caderno-${MESES[mesBase]}-${anoBase}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const novo = JSON.parse(reader.result);
        if (!Array.isArray(novo.itens)) throw new Error();
        salvar(novo);
        setOffset(0);
      } catch {
        setErro("Esse arquivo não é um backup do Caderno. Escolha o .json que você baixou daqui.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const m = emHistorico
    ? { nome: MESES[entryHistorico.mesBase], ano: entryHistorico.anoBase }
    : rotuloEm(offset);

  const resumos = meses.map((o) => ({
    offset: o,
    nome: rotuloEm(o).nome,
    ano: rotuloEm(o).ano,
    total: totalEm(o),
    encerram: encerramEm(o),
  }));

  const proximoMesLabel = futuro.length > 0 ? MESES[futuro[0].mesBase] : rotuloMes(mesBase, anoBase, 1).nome;

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 pb-28"
         style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="max-w-lg mx-auto px-5">

        <header className="pt-8 pb-5">
          <div className="flex justify-between items-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-stone-500 dark:text-stone-400 truncate">
              {session.user.email}
            </p>
            <div className="flex items-center gap-3 shrink-0">
              {salvando && <span className="text-[10px] text-stone-400 dark:text-stone-500">salvando…</span>}
              {!salvando && salvo && <span className="text-[10px] text-stone-400 dark:text-stone-500">salvo</span>}
              <BotaoTema tema={tema} onAlternar={onAlternarTema} />
              <button onClick={() => supabase.auth.signOut()}
                className="text-[10px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 underline focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
                sair
              </button>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <h1 className="text-3xl lowercase" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
              {m.nome} <span className="text-stone-400 dark:text-stone-500">{m.ano}</span>
            </h1>
            <div className="flex gap-1">
              <button onClick={() => setOffset(Math.max(-historico.length, offset - 1))}
                      disabled={offset <= -historico.length}
                      className="w-9 h-9 border border-stone-300 dark:border-stone-700 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">←</button>
              <button onClick={() => setOffset(Math.min(meses.length - 1, offset + 1))}
                      disabled={offset >= meses.length - 1}
                      className="w-9 h-9 border border-stone-300 dark:border-stone-700 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">→</button>
            </div>
          </div>
        </header>

        {!online && (
          <div className="mb-4 border-l-2 border-stone-800 dark:border-stone-200 bg-stone-200 dark:bg-stone-800 px-3 py-2 text-sm">
            Sem internet. Dá para ver o caderno, mas o que você alterar agora
            não vai salvar até a conexão voltar.
          </div>
        )}

        {erro && (
          <div className="mb-4 border-l-2 border-stone-800 dark:border-stone-200 bg-stone-200 dark:bg-stone-800 px-3 py-2 text-sm">
            {erro}
          </div>
        )}

        {(emHistorico || emFuturo) && aba === "mes" && (
          <div className="mb-4 border-l-2 border-stone-400 dark:border-stone-600 bg-stone-200 dark:bg-stone-800 px-3 py-2 text-sm flex justify-between items-center gap-3">
            <span className="text-stone-600 dark:text-stone-300">
              {emHistorico ? "Mês fechado" : "Mês futuro planejado"} — o que você lançar
              aqui fica só nesse mês, sem mexer no atual.
            </span>
            <button onClick={() => setOffset(0)}
              className="underline text-stone-800 dark:text-stone-200 shrink-0 focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
              voltar
            </button>
          </div>
        )}

        <div className="flex gap-2 mb-6">
          {[["mes", "o mês"], ["projecao", "projeção"], ["historico", "histórico"]].map(([k, r]) => (
            <button key={k} onClick={() => { setAba(k); setOffset(0); }}
              aria-current={aba === k ? "page" : undefined}
              className={`flex-1 py-2.5 text-sm tracking-wide border focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300 ${
                aba === k
                  ? "bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 border-stone-900 dark:border-stone-100"
                  : "border-stone-400 dark:border-stone-600 text-stone-500 dark:text-stone-400"}`}>
              {r}
            </button>
          ))}
        </div>

        {aba === "mes" && (
          emHistorico ? (
            <AbaMesHistorico
              entry={entryHistorico}
              onEditar={setForm}
              onRemover={(id) => removerHistorico(idxHistorico, id)}
            />
          ) : emFuturo ? (
            <AbaMesHistorico
              entry={entryFuturo}
              onEditar={setForm}
              onRemover={(id) => removerFuturo(idxFuturo, id)}
            />
          ) : (
            <AbaMes
              offset={offset === 0 ? 0 : offset - futuro.length}
              totalMes={totalEm(offset)}
              somaFixosMes={fixosEm(offset)}
              somaParcelasMes={parceladoEm(offset)}
              itensDoMes={itensEm(offset)}
              onEditar={setForm}
              onRemover={remover}
            />
          )
        )}

        {aba === "projecao" && (
          <AbaProjecao
            resumos={resumos}
            onExportar={exportar}
            onExportarCsv={exportarCsv}
            onImportar={importar}
          />
        )}

        {aba === "historico" && (
          <AbaHistorico
            historico={historico}
            onVerMes={(idx) => { setOffset(idx - historico.length); setAba("mes"); }}
          />
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-stone-100 dark:bg-stone-900 border-t border-stone-300 dark:border-stone-700"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-lg mx-auto px-5 py-3 flex gap-3">
          <button onClick={() => setForm({ tipo: "fixo", nome: "", valor: "", paga: 1, total: 3 })}
            className="flex-1 bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 py-3 text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-800 dark:focus:ring-stone-300">
            lançar conta
          </button>
          {emHistorico || emFuturo ? (
            <button onClick={() => setConfirmarAbrir(true)}
              className="px-4 border border-stone-400 dark:border-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
              abrir mês
            </button>
          ) : (
            <button onClick={() => setConfirmarFechar(true)}
              disabled={offset !== 0}
              title={offset !== 0 ? "só dá pra fechar o mês atual" : undefined}
              className="px-4 border border-stone-400 dark:border-stone-600 text-sm disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
              fechar mês
            </button>
          )}
        </div>
      </div>

      {confirmarFechar && (
        <ModalFecharMes
          mesAtual={rotuloMes(mesBase, anoBase, 0).nome}
          proximoMes={proximoMesLabel}
          adotaFuturo={futuro.length > 0}
          onConfirmar={virarMes}
          onCancelar={() => setConfirmarFechar(false)}
        />
      )}

      {confirmarAbrir && (
        <ModalAbrirMes
          mesAlvo={m.nome}
          mesAtual={rotuloMes(mesBase, anoBase, 0).nome}
          onConfirmar={abrirMes}
          onCancelar={() => setConfirmarAbrir(false)}
        />
      )}

      {form && (
        <FormConta
          form={form}
          setForm={setForm}
          onGravar={gravarForm}
          onCancelar={() => setForm(null)}
        />
      )}
    </div>
  );
}
