import { brl, MESES } from "../lib/caderno";

export default function AbaHistorico({ historico }) {
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
    <div className="space-y-6">
      {ordenado.map((h, idx) => {
        const totalMes = h.itens.reduce((s, it) => s + it.valor, 0);
        return (
          <div key={idx} className="border-b border-stone-300 pb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="lowercase text-sm">
                {MESES[h.mesBase]} <span className="text-stone-400">{h.anoBase}</span>
              </span>
              <span className="tabular-nums" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
                {brl(totalMes)}
              </span>
            </div>
            {h.itens.length === 0 ? (
              <p className="text-xs text-stone-500">Sem lançamentos.</p>
            ) : (
              <div className="space-y-1">
                {h.itens.map((it) => (
                  <div key={it.id} className="flex justify-between text-xs text-stone-600">
                    <span>{it.nome}</span>
                    <span className="tabular-nums">{brl(it.valor)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
