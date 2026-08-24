import React, { useState, useEffect, useRef } from "react";
import { supabase } from "./supabase";
import Login from "./Login.jsx";
import { MESES, ativoEm, faltam, rotuloMes, fecharMes, deslocarMes, posDoMes, mesmoMes, distanciaMeses } from "./lib/caderno";
import * as repo from "./lib/repositorio.js";
import { useTema } from "./lib/tema.js";
import AbaMes from "./components/AbaMes.jsx";
import AbaProjecao from "./components/AbaProjecao.jsx";
import { AvisoInstalar } from "./components/Instalar.jsx";
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
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: "var(--fundo)" }}>
      <p className="text-[15px] text-[var(--rotulo-2)]">abrindo o caderno</p>
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
  // Qual mês do calendário está na tela agora — usado pra reancorar a
  // posição depois de uma escrita que reordena a linha do tempo.
  const mesVisivelRef = useRef(null);
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

  // Uma escrita pode reordenar a linha do tempo: um mês do passado que passa
  // a existir empurra os índices, um mês que ficou vazio some. `offset` conta
  // passos, então o mesmo passo viraria outro mês — foi assim que lançar em
  // agosto jogava a tela pra junho. Reancora pelo mês, que não muda.
  const reancorar = (est) => {
    const alvo = mesVisivelRef.current;
    if (alvo && est?.dados) setOffset(posDoMes(alvo, est));
  };

  // Toda alteração passa por aqui: executa a escrita e relê o caderno do
  // banco. Antes o estado da tela era atualizado por conta própria e ia
  // separando da verdade a cada operação esquecida; agora o banco é quem
  // manda, e a tela é sempre o reflexo dele.
  const executar = async (acao) => {
    setSalvando(true);
    setSalvo(false);
    try {
      await acao();
      const novo = await repo.carregar(userId);
      aplicar(novo);
      reancorar(novo);
      setErro(null);
      setSalvo(true);
      return true;
    } catch (e) {
      setErro("Não deu para salvar. Tente de novo.");
      try {
        const novo = await repo.carregar(userId);
        aplicar(novo);
        reancorar(novo);
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
      <div className="min-h-screen flex items-center justify-center px-6"
           style={{ background: "var(--fundo)", color: "var(--rotulo)" }}>
        <div className="max-w-sm w-full text-center">
          <p className="text-[17px] mb-5">{erro || "Não deu para carregar seus dados."}</p>
          <button onClick={() => window.location.reload()}
            className="w-full py-3.5 rounded-xl text-[17px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--destaque)]"
            style={{ background: "var(--destaque)", color: "var(--sobre-destaque)" }}>
            Tentar de novo
          </button>
        </div>
      </div>
    );
  }

  const { itens, mesBase, anoBase } = dados;

  // A linha do tempo é a ordem das datas; `offset` é a distância até o mês
  // atual. Negativo cai no passado, positivo no planejado, e além do último
  // mês que existe a projeção é calculada.
  //
  // Pra trás um passo é sempre o mês anterior do calendário, exista registro
  // ou não. Antes o passo contava registros: quem tinha o mês atual adiantado
  // e nenhum histórico não tinha para onde voltar, e quem tinha um registro
  // antigo pulava direto pra ele — os meses do meio ficavam inalcançáveis.
  //
  // O limite é um ano antes do mês mais antigo que existe, pra que nenhum
  // histórico fique fora de alcance e a seta ainda pare em algum lugar.
  const recuoDoMaisAntigo =
    historico.length > 0 ? -distanciaMeses(dados, historico[0]) : 0;
  const limiteAtras = Math.max(12, recuoDoMaisAntigo + 12);
  const pos = Math.max(offset, -limiteAtras);

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
    if (o < 0) {
      const alvo = deslocarMes(dados.mesBase, dados.anoBase, o);
      return historico.find((mm) => mesmoMes(mm, alvo)) ?? null;
    }
    return null;
  };

  // No passado o mês pode existir (histórico) ou não (nunca foi registrado).
  const entryHistorico = pos < 0 ? registroEm(pos) : null;
  const emHistorico = entryHistorico !== null;
  const emPassadoVazio = pos < 0 && entryHistorico === null;

  // Projeção fala do que ainda vai acontecer; do passado não se infere nada.
  // Um mês atrás sem registro é um mês sem informação — abre vazio, não com
  // as contas de hoje espelhadas pra trás.
  const itensEm = (o) => {
    const reg = registroEm(o);
    if (reg) return reg.itens;
    if (o < 0) return [];
    return ultimoConcreto.itens.filter((it) => ativoEm(it, o - distanciaBase));
  };
  const fixosEm = (o) => itensEm(o).filter((i) => i.tipo === "fixo").reduce((s, i) => s + i.valor, 0);
  const parceladoEm = (o) => itensEm(o).filter((i) => i.tipo === "parcelado").reduce((s, i) => s + i.valor, 0);
  const totalEm = (o) => fixosEm(o) + parceladoEm(o);
  // Que mês do calendário cai nesse passo da linha do tempo.
  const mesEm = (o) => {
    const reg = registroEm(o);
    if (reg) return { mesBase: reg.mesBase, anoBase: reg.anoBase };
    if (o < 0) return deslocarMes(dados.mesBase, dados.anoBase, o);
    return deslocarMes(ultimoConcreto.mesBase, ultimoConcreto.anoBase, o - distanciaBase);
  };
  const rotuloEm = (o) => {
    const { mesBase: mb, anoBase: ab } = mesEm(o);
    return { nome: MESES[mb], ano: ab };
  };
  const encerramEm = (o) => {
    const reg = registroEm(o);
    if (reg) return reg.itens.filter((i) => i.tipo === "parcelado" && i.paga === i.total);
    if (o < 0) return [];
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
  const mesDaTela = () =>
    emHistorico ? entryHistorico
    : emFuturo ? entryFuturo
    : emPassadoVazio ? mesEm(pos)
    : dados;

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
    if (!alvo || alvo.id === dados.id) return;
    await executar(() => repo.abrirMesNoBanco(userId, alvo));
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
  mesVisivelRef.current = mesEm(pos);

  const resumos = meses.map((o) => ({
    offset: o,
    nome: rotuloEm(o).nome,
    ano: rotuloEm(o).ano,
    total: totalEm(o),
    encerram: encerramEm(o),
  }));

  const proximoMesLabel = futuro.length > 0 ? MESES[futuro[0].mesBase] : rotuloMes(mesBase, anoBase, 1).nome;


  return (
    <div className="min-h-screen text-[var(--rotulo)] pb-32"
         style={{ background: "var(--fundo)" }}>
      <div className="max-w-lg mx-auto px-4">

        <header className="pt-3">
          <div className="flex justify-between items-center gap-3 min-h-[44px]">
            <p className="text-[13px] text-[var(--rotulo-2)] truncate">
              {session.user.email}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              {salvando && <span className="text-[13px] text-[var(--rotulo-3)]">salvando…</span>}
              {!salvando && salvo && <span className="text-[13px] text-[var(--rotulo-3)]">salvo</span>}
              <BotaoTema tema={tema} onAlternar={onAlternarTema} />
              <button onClick={() => supabase.auth.signOut()}
                className="text-[17px] px-2 min-h-[44px] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
                Sair
              </button>
            </div>
          </div>

          {/* Large title do iOS, com a navegação de mês ao lado */}
          <div className="flex items-end justify-between gap-3 pt-1 pb-4">
            <h1 className="text-[34px] font-bold tracking-tight lowercase leading-none">
              {m.nome} <span className="text-[var(--rotulo-3)] font-normal">{m.ano}</span>
            </h1>
            <div className="flex gap-2 pb-1">
              <button onClick={() => setOffset(Math.max(-limiteAtras, pos - 1))}
                      disabled={pos <= -limiteAtras}
                      aria-label="Mês anterior"
                      className="w-9 h-9 rounded-full grid place-items-center bg-[var(--preenchido)] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
                <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden="true">
                  <path d="M7.5 1L1.5 7.5L7.5 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button onClick={() => setOffset(Math.min(meses.length - 1, pos + 1))}
                      disabled={pos >= meses.length - 1}
                      aria-label="Próximo mês"
                      className="w-9 h-9 rounded-full grid place-items-center bg-[var(--preenchido)] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
                <svg width="9" height="15" viewBox="0 0 9 15" fill="none" aria-hidden="true">
                  <path d="M1.5 1L7.5 7.5L1.5 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {!online && (
          <div className="mb-4 rounded-xl bg-[var(--cartao)] px-4 py-3 text-[13px] leading-snug">
            Sem internet. Dá para ver o caderno, mas o que você alterar agora
            não vai salvar até a conexão voltar.
          </div>
        )}

        {erro && (
          <div className="mb-4 rounded-xl bg-[var(--cartao)] px-4 py-3 text-[13px] leading-snug"
               style={{ color: "var(--perigo)" }}>
            {erro}
          </div>
        )}

        {aba === "mes" && !emHistorico && !emFuturo && !emPassadoVazio && <AvisoInstalar />}

        {(emHistorico || emFuturo || emPassadoVazio) && aba === "mes" && (
          <div className="mb-4 rounded-xl bg-[var(--cartao)] px-4 py-3">
            <div className="flex justify-between items-start gap-3">
              <span className="text-[13px] text-[var(--rotulo-2)] leading-snug">
                {emHistorico ? "Mês fechado"
                  : emFuturo ? "Mês futuro planejado"
                  : "Mês passado, ainda sem lançamento"} — o que você lançar
                aqui fica só nesse mês, sem mexer no atual.
              </span>
              <button onClick={() => setOffset(0)}
                className="text-[13px] font-semibold shrink-0 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
                Voltar
              </button>
            </div>
            {emFuturo && (
              <button onClick={() => setConfirmarApagar({ idx: idxFuturo, lista: "futuro" })}
                className="mt-2 text-[13px] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]"
                style={{ color: "var(--perigo)" }}>
                Descartar este planejamento
              </button>
            )}
          </div>
        )}

        {/* Segmented control */}
        <div className="flex gap-0.5 bg-[var(--preenchido)] rounded-lg p-0.5 mb-5">
          {[["mes", "o mês"], ["projecao", "projeção"], ["historico", "histórico"]].map(([k, r]) => (
            <button key={k} onClick={() => { setAba(k); setOffset(0); }}
              aria-current={aba === k ? "page" : undefined}
              className={`flex-1 py-1.5 text-[13px] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)] ${
                aba === k
                  ? "bg-[var(--cartao)] font-semibold shadow-sm"
                  : "text-[var(--rotulo-2)]"}`}>
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
              nomeDoMes={m.nome}
              passado={emPassadoVazio}
              offset={registroEm(pos) || emPassadoVazio ? 0 : pos - distanciaBase}
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
            onVerMes={(idx) => { setOffset(distanciaMeses(dados, historico[idx])); setAba("mes"); }}
            onApagarMes={(idx) => setConfirmarApagar({ idx, lista: "historico" })}
          />
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-[var(--separador)]"
           style={{ background: "var(--fundo)", paddingBottom: "max(env(safe-area-inset-bottom), 12px)" }}>
        <div className="max-w-lg mx-auto px-4 pt-3 flex gap-2.5">
          <button onClick={() => setForm({ tipo: "fixo", nome: "", valor: "", paga: 1, total: 3 })}
            className="flex-1 py-3.5 rounded-xl text-[17px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--destaque)]"
            style={{ background: "var(--destaque)", color: "var(--sobre-destaque)" }}>
            Lançar conta
          </button>
          {emHistorico || emFuturo || emPassadoVazio ? (
            <button onClick={() => setConfirmarAbrir(true)}
              className="px-5 py-3.5 rounded-xl text-[17px] bg-[var(--preenchido)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
              Abrir mês
            </button>
          ) : (
            <button onClick={() => setConfirmarFechar(true)}
              disabled={pos !== 0}
              title={pos !== 0 ? "só dá pra fechar o mês atual" : undefined}
              className="px-5 py-3.5 rounded-xl text-[17px] bg-[var(--preenchido)] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
              Fechar mês
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
