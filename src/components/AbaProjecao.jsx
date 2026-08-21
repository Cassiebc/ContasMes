import { brl } from "../lib/caderno";

export default function AbaProjecao({ resumos, onExportar, onExportarCsv, onImportar }) {
  const maxTotal = Math.max(1, ...resumos.map((r) => r.total));

  return (
    <div className="space-y-3">
      {resumos.map((r) => (
        <div key={r.offset} className="border-b border-stone-300 dark:border-stone-700 pb-3">
          <div className="flex justify-between items-baseline">
            <span className="lowercase text-sm">
              {r.nome} <span className="text-stone-400 dark:text-stone-500">{r.ano}</span>
            </span>
            <span className="tabular-nums" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
              {brl(r.total)}
            </span>
          </div>
          <div className="h-1.5 bg-stone-200 dark:bg-stone-800 mt-2">
            <div className="h-full bg-stone-900 dark:bg-stone-100" style={{ width: `${(r.total / maxTotal) * 100}%` }} />
          </div>
          {r.encerram.length > 0 && (
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
              última parcela: {r.encerram.map((e) => e.nome).join(", ")}
            </p>
          )}
        </div>
      ))}
      <p className="text-xs text-stone-500 dark:text-stone-400 pt-2">
        A projeção usa só o que está lançado. Compras novas entram por cima.
      </p>

      <div className="pt-4 border-t border-stone-300 dark:border-stone-700">
        <h3 className="text-[10px] uppercase tracking-[0.3em] text-stone-500 dark:text-stone-400 mb-2">backup</h3>
        <div className="flex gap-3">
          <button onClick={onExportar}
            className="flex-1 border border-stone-400 dark:border-stone-600 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
            baixar JSON
          </button>
          <button onClick={onExportarCsv}
            className="flex-1 border border-stone-400 dark:border-stone-600 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
            baixar CSV
          </button>
        </div>
        <label className="block mt-3 border border-stone-400 dark:border-stone-600 py-2 text-sm text-center cursor-pointer focus-within:ring-2 focus-within:ring-stone-800 dark:focus-within:ring-stone-300">
          restaurar
          <input type="file" accept="application/json" className="hidden" onChange={onImportar} />
        </label>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
          Os dados já ficam salvos no servidor. O JSON serve para
          restaurar aqui mesmo; o CSV é só para abrir em planilha —
          restaurar só aceita o formato JSON.
        </p>
      </div>
    </div>
  );
}
