import { brl } from "../lib/caderno";

export default function CardTotal({ total, fixos, parcelado }) {
  return (
    <div className="border border-stone-900 dark:border-stone-100 p-4 mb-6">
      <div className="flex justify-between items-end">
        <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400">total do mês</span>
        <span className="text-3xl tabular-nums" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          {brl(total)}
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-stone-300 dark:border-stone-700 flex justify-between text-sm tabular-nums text-stone-600 dark:text-stone-300">
        <span>fixos {brl(fixos)}</span>
        <span>parcelado {brl(parcelado)}</span>
      </div>
    </div>
  );
}
