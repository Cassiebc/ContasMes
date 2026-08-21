import React, { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Login from "./Login.jsx";

const MESES = ["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"];

// Caderno em branco, ancorado no mês em que a conta foi criada.
const novoCaderno = () => {
  const hoje = new Date();
  return {
    mesBase: hoje.getMonth(), // 0 = janeiro
    anoBase: hoje.getFullYear(),
    itens: [],
  };
};

const brl = (n) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Quantas parcelas ainda faltam depois do mês base
const faltam = (it) => (it.tipo === "fixo" ? Infinity : it.total - it.paga);

// O item aparece no mês `offset` (0 = mês base)?
const ativoEm = (it, offset) => {
  if (it.tipo === "fixo") return true;
  if (offset === 0) return true;
  return faltam(it) >= offset;
};

const rotuloMes = (base, ano, offset) => {
  const i = (base + offset) % 12;
  const a = ano + Math.floor((base + offset) / 12);
  return { nome: MESES[i], ano: a };
};

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
  const [dadosAnterior, setDadosAnterior] = useState(null);
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
        .select("dados, dados_anterior")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!vivo) return;
      if (error) {
        setErro("Não deu para carregar seus dados. Verifique a conexão.");
        setDados(null);
      } else if (data) {
        setDados(data.dados);
        setDadosAnterior(data.dados_anterior ?? null);
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
    const snapshot = dados;
    const novos = itens
      .map((i) => (i.tipo === "fixo" ? i : { ...i, paga: i.paga + 1 }))
      .filter((i) => i.tipo === "fixo" || i.paga <= i.total);
    const ok = await salvar(
      {
        ...dados,
        itens: novos,
        mesBase: (mesBase + 1) % 12,
        anoBase: anoBase + (mesBase === 11 ? 1 : 0),
      },
      { dados_anterior: snapshot }
    );
    if (ok) setDadosAnterior(snapshot);
    setOffset(0);
    setConfirmarFechar(false);
  };

  const desfazerFechamento = async () => {
    if (!dadosAnterior) return;
    const ok = await salvar(dadosAnterior, { dados_anterior: null });
    if (ok) setDadosAnterior(null);
    setOffset(0);
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
          {[["mes", "o mês"], ["projecao", "projeção"]].map(([k, r]) => (
            <button key={k} onClick={() => setAba(k)}
              className={`pb-2 text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-stone-800 ${
                aba === k ? "border-b-2 border-stone-900" : "text-stone-500"}`}>
              {r}
            </button>
          ))}
        </div>

        {aba === "mes" && (
          <>
            {dadosAnterior && offset === 0 && (
              <div className="mb-4 border-l-2 border-stone-400 bg-stone-200 px-3 py-2 text-sm flex justify-between items-center gap-3">
                <span className="text-stone-600">Mês fechado recentemente.</span>
                <button onClick={desfazerFechamento}
                  className="underline text-stone-800 shrink-0 focus:outline-none focus:ring-2 focus:ring-stone-800">
                  desfazer
                </button>
              </div>
            )}

            <div className="border border-stone-900 p-4 mb-6">
              <div className="flex justify-between items-end">
                <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">total do mês</span>
                <span className="text-3xl tabular-nums" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
                  {brl(total(offset))}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-stone-300 flex justify-between text-sm tabular-nums text-stone-600">
                <span>fixos {brl(somaFixos(offset))}</span>
                <span>parcelado {brl(somaParcelas(offset))}</span>
              </div>
            </div>

            {itens.length === 0 ? (
              <div className="border border-stone-300 border-dashed p-6 text-center">
                <p className="text-sm text-stone-600 mb-1">Caderno em branco.</p>
                <p className="text-xs text-stone-500">
                  Toque em <span className="text-stone-800">lançar conta</span> para
                  começar. Contas de todo mês entram como fixas; compras no cartão,
                  como parceladas.
                </p>
              </div>
            ) : (
              <>
                <Secao titulo="fixos"
                  itens={doMes(offset).filter((i) => i.tipo === "fixo")}
                  onEditar={setForm} onRemover={remover} offset={offset} />

                <Secao titulo="parcelado"
                  itens={doMes(offset).filter((i) => i.tipo === "parcelado")}
                  onEditar={setForm} onRemover={remover} offset={offset} />
              </>
            )}
          </>
        )}

        {aba === "projecao" && (
          <div className="space-y-3">
            {meses.map((o) => {
              const r = rotuloMes(mesBase, anoBase, o);
              const t = total(o);
              const encerram = itens.filter(
                (i) => i.tipo === "parcelado" && ativoEm(i, o) && !ativoEm(i, o + 1)
              );
              return (
                <div key={o} className="border-b border-stone-300 pb-3">
                  <div className="flex justify-between items-baseline">
                    <span className="lowercase text-sm">
                      {r.nome} <span className="text-stone-400">{r.ano}</span>
                    </span>
                    <span className="tabular-nums" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
                      {brl(t)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-stone-200 mt-2">
                    <div className="h-full bg-stone-900" style={{ width: `${(t / maxTotal) * 100}%` }} />
                  </div>
                  {encerram.length > 0 && (
                    <p className="text-xs text-stone-500 mt-2">
                      última parcela: {encerram.map((e) => e.nome).join(", ")}
                    </p>
                  )}
                </div>
              );
            })}
            <p className="text-xs text-stone-500 pt-2">
              A projeção usa só o que está lançado. Compras novas entram por cima.
            </p>

            <div className="pt-4 border-t border-stone-300">
              <h3 className="text-[10px] uppercase tracking-[0.3em] text-stone-500 mb-2">backup</h3>
              <div className="flex gap-3">
                <button onClick={exportar}
                  className="flex-1 border border-stone-400 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800">
                  baixar cópia
                </button>
                <label className="flex-1 border border-stone-400 py-2 text-sm text-center cursor-pointer">
                  restaurar
                  <input type="file" accept="application/json" className="hidden" onChange={importar} />
                </label>
              </div>
              <p className="text-xs text-stone-500 mt-2">
                Os dados ficam só neste iPhone. Baixe uma cópia de vez em quando.
              </p>
            </div>
          </div>
        )}
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
        <div className="fixed inset-0 bg-stone-900 bg-opacity-40 flex items-end sm:items-center justify-center z-10">
          <div className="bg-stone-100 w-full max-w-lg p-5">
            <h2 className="text-xl lowercase mb-3" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
              fechar {m.nome}?
            </h2>
            <p className="text-sm text-stone-600 mb-5">
              Cada parcela avança uma casa e o mês vira {rotuloMes(mesBase, anoBase, 1).nome}.
              Não dá pra desfazer.
            </p>
            <div className="flex gap-3">
              <button onClick={virarMes}
                className="flex-1 bg-stone-900 text-stone-50 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800">
                fechar mês
              </button>
              <button onClick={() => setConfirmarFechar(false)}
                className="px-5 border border-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800">
                cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {form && (
        <div className="fixed inset-0 bg-stone-900 bg-opacity-40 flex items-end sm:items-center justify-center z-10">
          <div className="bg-stone-100 w-full max-w-lg p-5 max-h-full overflow-y-auto">
            <h2 className="text-xl lowercase mb-4" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
              {form.id ? "editar conta" : "nova conta"}
            </h2>

            <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-1">nome</label>
            <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
              className="w-full border border-stone-400 bg-transparent px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-stone-800" />

            <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-1">valor da parcela</label>
            <input value={form.valor} inputMode="decimal" placeholder="0,00"
              onChange={(e) => setForm({ ...form, valor: e.target.value })}
              className="w-full border border-stone-400 bg-transparent px-3 py-2 mb-4 tabular-nums focus:outline-none focus:ring-2 focus:ring-stone-800" />

            <div className="flex gap-2 mb-4">
              {[["fixo", "todo mês"], ["parcelado", "parcelado"]].map(([k, r]) => (
                <button key={k} onClick={() => setForm({ ...form, tipo: k })}
                  className={`flex-1 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-stone-800 ${
                    form.tipo === k ? "bg-stone-900 text-stone-50 border-stone-900" : "border-stone-400"}`}>
                  {r}
                </button>
              ))}
            </div>

            {form.tipo === "parcelado" && (
              <div className="flex gap-3 mb-4">
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-1">já paguei</label>
                  <input value={form.paga} inputMode="numeric"
                    onChange={(e) => setForm({ ...form, paga: e.target.value })}
                    className="w-full border border-stone-400 bg-transparent px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-stone-800" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500 mb-1">de quantas</label>
                  <input value={form.total} inputMode="numeric"
                    onChange={(e) => setForm({ ...form, total: e.target.value })}
                    className="w-full border border-stone-400 bg-transparent px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-stone-800" />
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={gravarForm}
                className="flex-1 bg-stone-900 text-stone-50 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800">
                gravar
              </button>
              <button onClick={() => setForm(null)}
                className="px-5 border border-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800">
                cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Secao({ titulo, itens, onEditar, onRemover, offset }) {
  if (itens.length === 0) return null;
  return (
    <section className="mb-7">
      <h2 className="text-[10px] uppercase tracking-[0.3em] text-stone-500 mb-2">{titulo}</h2>
      <div className="border-t border-stone-300">
        {itens.map((it) => {
          const parcelaAtual = it.tipo === "parcelado" ? it.paga + offset : null;
          const resta = it.tipo === "parcelado" ? it.total - parcelaAtual : null;
          return (
            <div key={it.id} className="border-b border-stone-300 py-3 flex items-center gap-3">
              <button onClick={() => onEditar({ ...it })}
                className="flex-1 text-left focus:outline-none focus:ring-2 focus:ring-stone-800">
                <div className="text-sm">{it.nome}</div>
                {it.tipo === "parcelado" && (
                  <div className="text-xs text-stone-500 tabular-nums mt-0.5">
                    {String(parcelaAtual).padStart(2, "0")}/{String(it.total).padStart(2, "0")}
                    {resta === 0 ? " · última" : ` · faltam ${resta}`}
                  </div>
                )}
              </button>
              <span className="tabular-nums text-sm" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
                {brl(it.valor)}
              </span>
              <button onClick={() => onRemover(it.id)} aria-label={`Remover ${it.nome}`}
                className="text-stone-400 px-1 focus:outline-none focus:ring-2 focus:ring-stone-800">×</button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
