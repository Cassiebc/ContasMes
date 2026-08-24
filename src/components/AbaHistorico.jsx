import { brl, MESES } from "../lib/caderno";

export default function AbaHistorico({ historico, onVerMes, onApagarMes }) {
  if (historico.length === 0) {
    return (
      <div className="bg-[var(--cartao)] rounded-xl px-5 py-8 text-center">
        <p className="text-[17px] mb-1">Nenhum mês fechado ainda.</p>
        <p className="text-[13px] text-[var(--rotulo-2)] leading-relaxed">
          Toda vez que você fechar um mês, ele fica guardado aqui — com os
          itens exatamente como estavam na época, sem se misturar com o mês
          atual.
        </p>
      </div>
    );
  }

  // mais recente primeiro, mas guarda o índice real (não invertido) pra
  // navegação — é ele que vira offset negativo em App.jsx.
  const ordenado = historico.map((h, i) => [h, i]).reverse();

  return (
    <div>
      <div className="bg-[var(--cartao)] rounded-xl overflow-hidden lista-ios">
        {ordenado.map(([h, idx]) => {
          const totalMes = h.itens.reduce((s, it) => s + it.valor, 0);
          return (
            <div key={idx} className="flex items-center gap-2 px-4 min-h-[44px]">
              <button onClick={() => onVerMes(idx)}
                className="flex-1 flex justify-between items-baseline gap-3 py-3 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
                <span className="text-[17px] lowercase">
                  {MESES[h.mesBase]} <span className="text-[var(--rotulo-3)]">{h.anoBase}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[17px] tabular">{brl(totalMes)}</span>
                  <span aria-hidden="true" className="text-[var(--rotulo-3)] text-[15px]">›</span>
                </span>
              </button>
              <button onClick={() => onApagarMes(idx)}
                aria-label={`Apagar ${MESES[h.mesBase]} de ${h.anoBase} do histórico`}
                className="w-11 h-11 -mr-2 shrink-0 grid place-items-center text-[22px] leading-none text-[var(--rotulo-3)] rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
                ×
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[13px] text-[var(--rotulo-2)] px-4 mt-2 leading-relaxed">
        Toque num mês para abri-lo. O × apaga o mês do histórico — útil se o
        mesmo mês aparecer repetido aqui.
      </p>
    </div>
  );
}
