import { brl } from "../lib/caderno";

export default function CardTotal({ total, fixos, parcelado }) {
  return (
    <div className="bg-[var(--cartao)] rounded-xl p-4 mb-5">
      <div className="flex justify-between items-baseline gap-3">
        <span className="text-[13px] uppercase tracking-wide text-[var(--rotulo-2)]">
          total do mês
        </span>
        <span className="text-[30px] font-bold tracking-tight tabular">
          {brl(total)}
        </span>
      </div>
      <div className="mt-3 pt-3 border-t border-[var(--separador)] flex justify-between text-[13px] text-[var(--rotulo-2)] tabular">
        <span>fixos {brl(fixos)}</span>
        <span>parcelado {brl(parcelado)}</span>
      </div>
    </div>
  );
}
