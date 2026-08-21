import { useState } from "react";
import { brl, MESES } from "../lib/caderno";
import Secao from "./Secao";
import CardTotal from "./CardTotal";

export default function AbaHistorico({ historico }) {
  const [aberto, setAberto] = useState(null);

  if (historico.length === 0) {
    return (
      <div className="border border-stone-300 border-dashed p-6 text-center">
        <p className="text-sm text-stone-600 mb-1">Nenhum mês fechado ainda.</p>
        <p className="text-xs text-stone-500">
          Toda vez que você fechar um mês, ele fica guardado aqui — com os
          itens exatamente como estavam na época, sem se misturar com o mês
          atual.
        </p>
      </div>
    );
  }

  // mais recente primeiro
  const ordenado = [...historico].reverse();

  return (
    <div>
      {ordenado.map((h, idx) => {
        const fixos = h.itens.filter((i) => i.tipo === "fixo");
        const parcelados = h.itens.filter((i) => i.tipo === "parcelado");
        const totalFixos = fixos.reduce((s, it) => s + it.valor, 0);
        const totalParcelados = parcelados.reduce((s, it) => s + it.valor, 0);
        const totalMes = totalFixos + totalParcelados;
        const expandido = aberto === idx;
        return (
          <div key={idx} className="border-b border-stone-300">
            <button onClick={() => setAberto(expandido ? null : idx)}
              aria-expanded={expandido}
              className="w-full flex justify-between items-baseline py-3 text-left focus:outline-none focus:ring-2 focus:ring-stone-800">
              <span className="lowercase text-sm flex items-center gap-2">
                <span className="text-stone-400 w-3 inline-block">{expandido ? "▾" : "▸"}</span>
                {MESES[h.mesBase]} <span className="text-stone-400">{h.anoBase}</span>
              </span>
              <span className="tabular-nums" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
                {brl(totalMes)}
              </span>
            </button>
            {expandido && (
              <div className="pb-5 pl-5">
                {h.itens.length === 0 ? (
                  <p className="text-xs text-stone-500 pb-2">Sem lançamentos.</p>
                ) : (
                  <>
                    <CardTotal total={totalMes} fixos={totalFixos} parcelado={totalParcelados} />
                    <Secao titulo="fixos" itens={fixos} offset={0} readOnly />
                    <Secao titulo="parcelado" itens={parcelados} offset={0} readOnly />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
