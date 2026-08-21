import { brl, MESES } from "../lib/caderno";

export default function AbaHistorico({ historico, onVerMes }) {
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
        const totalMes = h.itens.reduce((s, it) => s + it.valor, 0);
        return (
          <button key={idx} onClick={() => onVerMes(h)}
            className="w-full flex justify-between items-baseline py-3 border-b border-stone-300 text-left focus:outline-none focus:ring-2 focus:ring-stone-800">
            <span className="lowercase text-sm flex items-center gap-2">
              <span className="text-stone-400">›</span>
              {MESES[h.mesBase]} <span className="text-stone-400">{h.anoBase}</span>
            </span>
            <span className="tabular-nums" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
              {brl(totalMes)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
