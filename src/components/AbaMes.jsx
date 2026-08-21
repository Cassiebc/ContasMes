import { brl } from "../lib/caderno";
import Secao from "./Secao";

export default function AbaMes({
  offset,
  totalMes, somaFixosMes, somaParcelasMes,
  itensDoMes, onEditar, onRemover,
}) {
  return (
    <>
      <div className="border border-stone-900 p-4 mb-6">
        <div className="flex justify-between items-end">
          <span className="text-[10px] uppercase tracking-[0.2em] text-stone-500">total do mês</span>
          <span className="text-3xl tabular-nums" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
            {brl(totalMes)}
          </span>
        </div>
        <div className="mt-3 pt-3 border-t border-stone-300 flex justify-between text-sm tabular-nums text-stone-600">
          <span>fixos {brl(somaFixosMes)}</span>
          <span>parcelado {brl(somaParcelasMes)}</span>
        </div>
      </div>

      {itensDoMes.length === 0 ? (
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
            itens={itensDoMes.filter((i) => i.tipo === "fixo")}
            onEditar={onEditar} onRemover={onRemover} offset={offset} />

          <Secao titulo="parcelado"
            itens={itensDoMes.filter((i) => i.tipo === "parcelado")}
            onEditar={onEditar} onRemover={onRemover} offset={offset} />
        </>
      )}
    </>
  );
}
