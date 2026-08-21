import { brl } from "../lib/caderno";

export default function Secao({ titulo, itens, onEditar, onRemover, offset }) {
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
