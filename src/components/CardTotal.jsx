import { brl } from "../lib/caderno";

export default function CardTotal({ total, fixos, parcelado, aVista = 0 }) {
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
      {/* Três valores não cabem lado a lado num iPhone pequeno, então a linha
          quebra em vez de espremer. "à vista" só aparece quando existe: quem
          não usa vê o cartão igual ao de antes. */}
      <div className="mt-3 pt-3 border-t border-[var(--separador)] flex flex-wrap justify-between gap-x-4 gap-y-1 text-[13px] text-[var(--rotulo-2)] tabular">
        <span>fixos {brl(fixos)}</span>
        <span>parcelado {brl(parcelado)}</span>
        {aVista > 0 && <span>à vista {brl(aVista)}</span>}
      </div>
    </div>
  );
}
