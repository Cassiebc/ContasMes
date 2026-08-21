import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Login from "./Login.jsx";
import { MESES, novoCaderno, ativoEm, faltam, rotuloMes, fecharMes } from "./lib/caderno";
import AbaMes from "./components/AbaMes.jsx";
import AbaProjecao from "./components/AbaProjecao.jsx";
import AbaHistorico from "./components/AbaHistorico.jsx";
import ModalFecharMes from "./components/ModalFecharMes.jsx";
import FormConta from "./components/FormConta.jsx";

export default function App() {
  const [session, setSession] = useState(null);
  const [checando, setChecando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (checando) return <Abrindo />;
  if (!session) return <Login />;
  return <CadernoContas session={session} key={session.user.id} />;
}

function Abrindo() {
  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center">
      <p className="text-stone-500 text-sm tracking-widest uppercase">
        abrindo o caderno
      </p>
    </div>
  );
}

function CadernoContas({ session }) {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [aba, setAba] = useState("mes");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState(null);
  const [confirmarFechar, setConfirmarFechar] = useState(false);
  const [historico, setHistorico] = useState([]);
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
        .select("dados, dados_anterior, historico")
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

  // `extra` permite incluir outras colunas no mesmo upsert (ex.: dados_anterior),
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

  if (carregando) return <Abrindo />;

  if (!dados) {
    return (
      <div className="min-h-screen bg-stone-100 flex items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <p className="text-sm mb-4">
            {erro || "Não deu para carregar seus dados."}
          </p>
          <button onClick={() => window.location.reload()}
            className="border border-stone-400 px-5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800">
            tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const { itens, mesBase, anoBase } = dados;

  const doMes = (off) => itens.filter((it) => ativoEm(it, off));
  const somaFixos = (off) =>
    doMes(off).filter((i) => i.tipo === "fixo").reduce((s, i) => s + i.valor, 0);
  const somaParcelas = (off) =>
    doMes(off).filter((i) => i.tipo === "parcelado").reduce((s, i) => s + i.valor, 0);
  const total = (off) => somaFixos(off) + somaParcelas(off);

  const horizonte = Math.max(
    3,
    ...itens.filter((i) => i.tipo === "parcelado").map((i) => faltam(i))
  );
  const meses = Array.from({ length: Math.min(horizonte + 1, 13) }, (_, i) => i);
  const maxTotal = Math.max(1, ...meses.map(total));

  const remover = (id) => salvar({ ...dados, itens: itens.filter((i) => i.id !== id) });

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
    const lista = form.id
      ? itens.map((i) => (i.id === form.id ? novo : i))
      : [...itens, novo];
    salvar({ ...dados, itens: lista });
    setForm(null);
  };

  const virarMes = async () => {
    const novoHistorico = [
      ...historico,
      { mesBase, anoBase, itens, fechadoEm: new Date().toISOString() },
    ];
    const ok = await salvar(
      { ...dados, ...fecharMes(dados) },
      { historico: novoHistorico }
    );
    if (ok) setHistorico(novoHistorico);
    setOffset(0);
    setConfirmarFechar(false);
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

  const m = rotuloMes(mesBase, anoBase, offset);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 pb-28"
         style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="max-w-lg mx-auto px-5">

        <header className="pt-8 pb-5">
          <div className="flex justify-between items-center">
            <p className="text-[10px] uppercase tracking-[0.3em] text-stone-500 truncate">
              {session.user.email}
            </p>
            <div className="flex items-center gap-3 shrink-0">
              {salvando && <span className="text-[10px] text-stone-400">salvando…</span>}
              {!salvando && salvo && <span className="text-[10px] text-stone-400">salvo</span>}
              <button onClick={() => supabase.auth.signOut()}
                className="text-[10px] uppercase tracking-[0.2em] text-stone-500 underline focus:outline-none focus:ring-2 focus:ring-stone-800">
                sair
              </button>
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-2">
            <h1 className="text-3xl lowercase" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
              {m.nome} <span className="text-stone-400">{m.ano}</span>
            </h1>
            <div className="flex gap-1">
              <button onClick={() => setOffset(Math.max(0, offset - 1))}
                      disabled={offset === 0}
                      className="w-9 h-9 border border-stone-300 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-stone-800">←</button>
              <button onClick={() => setOffset(Math.min(meses.length - 1, offset + 1))}
                      disabled={offset >= meses.length - 1}
                      className="w-9 h-9 border border-stone-300 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-stone-800">→</button>
            </div>
          </div>
        </header>

        {!online && (
          <div className="mb-4 border-l-2 border-stone-800 bg-stone-200 px-3 py-2 text-sm">
            Sem internet. Dá para ver o caderno, mas o que você alterar agora
            não vai salvar até a conexão voltar.
          </div>
        )}

        {erro && (
          <div className="mb-4 border-l-2 border-stone-800 bg-stone-200 px-3 py-2 text-sm">
            {erro}
          </div>
        )}

        <div className="flex gap-6 border-b border-stone-300 mb-5">
          {[["mes", "o mês"], ["projecao", "projeção"], ["historico", "histórico"]].map(([k, r]) => (
            <button key={k} onClick={() => setAba(k)}
              className={`pb-2 text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-stone-800 ${
                aba === k ? "border-b-2 border-stone-900" : "text-stone-500"}`}>
              {r}
            </button>
          ))}
        </div>

        {aba === "mes" && (
          <AbaMes
            offset={offset}
            totalMes={total(offset)}
            somaFixosMes={somaFixos(offset)}
            somaParcelasMes={somaParcelas(offset)}
            itensDoMes={doMes(offset)}
            onEditar={setForm}
            onRemover={remover}
          />
        )}

        {aba === "projecao" && (
          <AbaProjecao
            meses={meses}
            mesBase={mesBase}
            anoBase={anoBase}
            total={total}
            maxTotal={maxTotal}
            itens={itens}
            onExportar={exportar}
            onExportarCsv={exportarCsv}
            onImportar={importar}
          />
        )}

        {aba === "historico" && <AbaHistorico historico={historico} />}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-stone-100 border-t border-stone-300"
           style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="max-w-lg mx-auto px-5 py-3 flex gap-3">
          <button onClick={() => setForm({ tipo: "fixo", nome: "", valor: "", paga: 1, total: 3 })}
            className="flex-1 bg-stone-900 text-stone-50 py-3 text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-800">
            lançar conta
          </button>
          <button onClick={() => setConfirmarFechar(true)}
            className="px-4 border border-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800">
            fechar mês
          </button>
        </div>
      </div>

      {confirmarFechar && (
        <ModalFecharMes
          mesAtual={m.nome}
          proximoMes={rotuloMes(mesBase, anoBase, 1).nome}
          onConfirmar={virarMes}
          onCancelar={() => setConfirmarFechar(false)}
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
