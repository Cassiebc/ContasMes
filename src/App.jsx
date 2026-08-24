import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Login from "./Login.jsx";
import { MESES, ativoEm, faltam, rotuloMes, fecharMes } from "./lib/caderno";
import * as repo from "./lib/repositorio.js";
import { useTema } from "./lib/tema.js";
import AbaMes from "./components/AbaMes.jsx";
import AbaProjecao from "./components/AbaProjecao.jsx";
import AbaHistorico from "./components/AbaHistorico.jsx";
import AbaMesHistorico from "./components/AbaMesHistorico.jsx";
import ModalFecharMes from "./components/ModalFecharMes.jsx";
import ModalAbrirMes from "./components/ModalAbrirMes.jsx";
import ModalApagarMes from "./components/ModalApagarMes.jsx";
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
  const userId = session.user.id;

  const [dados, setDados] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [futuro, setFuturo] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [aba, setAba] = useState("mes");
  const [offset, setOffset] = useState(0);
  const [form, setForm] = useState(null);
  const [confirmarFechar, setConfirmarFechar] = useState(false);
  const [confirmarAbrir, setConfirmarAbrir] = useState(false);
  const [confirmarApagar, setConfirmarApagar] = useState(null);
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
    if (!salvo) return;
    const t = setTimeout(() => setSalvo(false), 2000);
    return () => clearTimeout(t);
  }, [salvo]);

  const aplicar = (estado) => {
    setDados(estado.dados);
    setHistorico(estado.historico);
    setFuturo(estado.futuro);
  };

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        await repo.migrarDoFormatoAntigo(userId);
        const estado = await repo.carregar(userId);
        if (!vivo) return;
        aplicar(estado);
      } catch (e) {
        if (!vivo) return;
        setErro("Não deu para carregar seus dados. Verifique a conexão.");
        setDados(null);
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => { vivo = false; };
  }, [userId]);

  // Toda alteração passa por aqui: executa a escrita e relê o caderno do
  // banco. Antes o estado da tela era atualizado por conta própria e ia
  // separando da verdade a cada operação esquecida; agora o banco é quem
  // manda, e a tela é sempre o reflexo dele.
  const executar = async (acao) => {
    setSalvando(true);
    setSalvo(false);
    try {
      await acao();
      aplicar(await repo.carregar(userId));
      setErro(null);
      setSalvo(true);
      return true;
    } catch (e) {
      setErro("Não deu para salvar. Tente de novo.");
      try {
        aplicar(await repo.carregar(userId));
      } catch {
        // sem conexão: mantém o que está na tela
      }
      return false;
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <Abrindo />;

  if (!dados) {
    return (
      <div className="min-h-screen bg-stone-100 dark:bg-stone-900 dark:text-stone-100 flex items-center justify-center px-5">
        <div className="max-w-sm text-center">
          <p className="text-sm mb-4">{erro || "Não deu para carregar seus dados."}</p>
          <button onClick={() => window.location.reload()}
            className="border border-stone-400 dark:border-stone-600 px-5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
            tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const { itens, mesBase, anoBase } = dados;

  // A linha do tempo é a ordem das datas; `offset` é a distância até o mês
  // atual. Negativo cai no histórico, positivo no planejado, e além do
  // último mês que existe a projeção é calculada.
  const pos = Math.max(offset, -historico.length);

  const emHistorico = pos < 0;
  const idxHistorico = emHistorico ? pos + historico.length : null;
  const entryHistorico = emHistorico ? historico[idxHistorico] : null;

  const emFuturo = pos > 0 && pos <= futuro.length;
  const idxFuturo = emFuturo ? pos - 1 : null;
  const entryFuturo = emFuturo ? futuro[idxFuturo] : null;

  // A projeção continua de onde a linha do tempo concreta parou — o último
  // mês planejado, ou o atual quando não há planejamento.
  const ultimoConcreto = futuro.length > 0 ? futuro[futuro.length - 1] : dados;
  const distanciaBase = futuro.length;

  const registroEm = (o) => {
    if (o === 0) return dados;
    if (o > 0 && o <= futuro.length) return futuro[o - 1];
    return null;
  };
  const itensEm = (o) => {
    const reg = registroEm(o);
    if (reg) return reg.itens;
    return ultimoConcreto.itens.filter((it) => ativoEm(it, o - distanciaBase));
  };
  const fixosEm = (o) => itensEm(o).filter((i) => i.tipo === "fixo").reduce((s, i) => s + i.valor, 0);
  const parceladoEm = (o) => itensEm(o).filter((i) => i.tipo === "parcelado").reduce((s, i) => s + i.valor, 0);
  const totalEm = (o) => fixosEm(o) + parceladoEm(o);
  const rotuloEm = (o) => {
    const reg = registroEm(o);
    if (reg) return { nome: MESES[reg.mesBase], ano: reg.anoBase };
    return rotuloMes(ultimoConcreto.mesBase, ultimoConcreto.anoBase, o - distanciaBase);
  };
  const encerramEm = (o) => {
    const reg = registroEm(o);
    if (reg) return reg.itens.filter((i) => i.tipo === "parcelado" && i.paga === i.total);
    const rel = o - distanciaBase;
    return ultimoConcreto.itens.filter(
      (i) => i.tipo === "parcelado" && ativoEm(i, rel) && !ativoEm(i, rel + 1)
    );
  };

  const horizonteComputado = Math.max(
    3,
    ...ultimoConcreto.itens.filter((i) => i.tipo === "parcelado").map((i) => faltam(i))
  );
  const meses = Array.from(
    { length: Math.min(futuro.length + horizonteComputado + 1, 13) },
    (_, i) => i
  );

  // Em que mês a alteração cai: o que está na tela, quando ele existe de
  // fato; senão o mês atual (a zona de projeção não tem registro próprio).
  const mesDaTela = () => (emHistorico ? entryHistorico : emFuturo ? entryFuturo : dados);

  const remover = (id) => executar(() => repo.removerLancamento(id));

  const gravarForm = () => {
    const nome = (form.nome || "").trim();
    const valor = parseFloat(String(form.valor).replace(",", "."));
    if (!nome || !valor || valor <= 0) return;

    const item = {
      nome,
      valor,
      tipo: form.tipo,
      ...(form.tipo === "parcelado"
        ? (() => {
            const paga = Math.max(1, parseInt(form.paga) || 1);
            return { paga, total: Math.max(paga, parseInt(form.total) || 1) };
          })()
        : {}),
    };

    const alvo = mesDaTela();
    executar(() =>
      form.id ? repo.editarLancamento(form.id, item) : repo.lancar(userId, alvo, item)
    );
    setForm(null);
  };

  const virarMes = async () => {
    const planejado = futuro[0];
    const avancado = fecharMes(dados);
    const proximo = planejado ?? { mesBase: avancado.mesBase, anoBase: avancado.anoBase };
    await executar(() =>
      repo.fecharMesNoBanco(userId, dados, planejado ? [] : avancado.itens, proximo)
    );
    setOffset(0);
    setConfirmarFechar(false);
  };

  // Vira o mês visto no mês atual. Nada é movido de lista: só muda qual mês
  // carrega a marca de atual, e a linha do tempo se reordena pelas datas.
  const abrirMes = async () => {
    const alvo = mesDaTela();
    if (!alvo?.id || alvo.id === dados.id) return;
    await executar(() => repo.definirAtual(userId, alvo.id));
    setOffset(0);
    setConfirmarAbrir(false);
  };

  const apagarMes = async () => {
    const lista = confirmarApagar.lista === "historico" ? historico : futuro;
    const alvo = lista[confirmarApagar.idx];
    if (alvo?.id) await executar(() => repo.apagarMes(alvo.id));
    setOffset(0);
    setConfirmarApagar(null);
  };

  const exportar = () => {
    const semId = (m) => ({
      mesBase: m.mesBase,
      anoBase: m.anoBase,
      itens: m.itens.map(({ id, ...resto }) => resto),
      ...(m.fechadoEm ? { fechadoEm: m.fechadoEm } : {}),
    });
    const caderno = {
      versao: 2,
      dados: semId(dados),
      historico: historico.map(semId),
      futuro: futuro.map(semId),
    };
    const blob = new Blob([JSON.stringify(caderno, null, 2)], { type: "application/json" });
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

  // Restaurar troca o caderno inteiro pelo do arquivo.
  const importar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const lido = JSON.parse(reader.result);
        let novo;
        if (lido && lido.dados && Array.isArray(lido.dados.itens)) {
          novo = {
            dados: lido.dados,
            historico: Array.isArray(lido.historico) ? lido.historico : [],
            futuro: Array.isArray(lido.futuro) ? lido.futuro : [],
          };
        } else if (lido && Array.isArray(lido.itens)) {
          // Formato antigo: só o mês vira o caderno todo.
          novo = { dados: lido, historico: [], futuro: [] };
        } else {
          throw new Error("formato desconhecido");
        }
        await executar(() => repo.substituirTudo(userId, novo));
        setOffset(0);
      } catch {
        setErro("Esse arquivo não é um backup do Caderno. Escolha o .json que você baixou daqui.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const m = rotuloEm(pos);

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
              <button onClick={() => setOffset(Math.max(-historico.length, pos - 1))}
                      disabled={pos <= -historico.length}
                      className="w-9 h-9 border border-stone-300 dark:border-stone-700 disabled:opacity-30 focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">←</button>
              <button onClick={() => setOffset(Math.min(meses.length - 1, pos + 1))}
                      disabled={pos >= meses.length - 1}
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
          <div className="mb-4 border-l-2 border-stone-400 dark:border-stone-600 bg-stone-200 dark:bg-stone-800 px-3 py-2 text-sm">
            <div className="flex justify-between items-center gap-3">
              <span className="text-stone-600 dark:text-stone-300">
                {emHistorico ? "Mês fechado" : "Mês futuro planejado"} — o que você lançar
                aqui fica só nesse mês, sem mexer no atual.
              </span>
              <button onClick={() => setOffset(0)}
                className="underline text-stone-800 dark:text-stone-200 shrink-0 focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
                voltar
              </button>
            </div>
            {emFuturo && (
              <button onClick={() => setConfirmarApagar({ idx: idxFuturo, lista: "futuro" })}
                className="mt-1 underline text-stone-500 dark:text-stone-400 text-xs focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
                descartar este planejamento
              </button>
            )}
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
          emHistorico || emFuturo ? (
            <AbaMesHistorico
              entry={emHistorico ? entryHistorico : entryFuturo}
              onEditar={setForm}
              onRemover={remover}
            />
          ) : (
            <AbaMes
              // Num mês concreto os itens já trazem a parcela certa (offset 0);
              // num mês calculado, conta a distância desde o último concreto.
              offset={registroEm(pos) ? 0 : pos - distanciaBase}
              totalMes={totalEm(pos)}
              somaFixosMes={fixosEm(pos)}
              somaParcelasMes={parceladoEm(pos)}
              itensDoMes={itensEm(pos)}
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
            onApagarMes={(idx) => setConfirmarApagar({ idx, lista: "historico" })}
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
              disabled={pos !== 0}
              title={pos !== 0 ? "só dá pra fechar o mês atual" : undefined}
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

      {confirmarApagar && (confirmarApagar.lista === "historico" ? historico : futuro)[confirmarApagar.idx] && (() => {
        const alvo = (confirmarApagar.lista === "historico" ? historico : futuro)[confirmarApagar.idx];
        return (
          <ModalApagarMes
            mes={MESES[alvo.mesBase]}
            ano={alvo.anoBase}
            total={alvo.itens.reduce((s, i) => s + i.valor, 0)}
            planejado={confirmarApagar.lista === "futuro"}
            onConfirmar={apagarMes}
            onCancelar={() => setConfirmarApagar(null)}
          />
        );
      })()}

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
