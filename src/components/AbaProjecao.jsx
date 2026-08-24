import { brl } from "../lib/caderno";
import { LinhaInstalar } from "./Instalar.jsx";

export default function AbaProjecao({ resumos, onExportar, onExportarCsv, onImportar }) {
  const maxTotal = Math.max(1, ...resumos.map((r) => r.total));

  return (
    <div>
      <div className="bg-[var(--cartao)] rounded-xl overflow-hidden lista-ios mb-2">
        {resumos.map((r) => (
          <div key={r.offset} className="px-4 py-3">
            <div className="flex justify-between items-baseline gap-3">
              <span className="text-[17px] lowercase">
                {r.nome} <span className="text-[var(--rotulo-3)]">{r.ano}</span>
              </span>
              <span className="text-[17px] tabular">{brl(r.total)}</span>
            </div>
            {/* A barra compara os meses entre si; é leitura rápida, não medida
                exata — o valor ao lado é quem dá o número. */}
            <div className="h-1 rounded-full bg-[var(--preenchido)] mt-2 overflow-hidden">
              <div className="h-full rounded-full bg-[var(--rotulo-2)]"
                   style={{ width: `${(r.total / maxTotal) * 100}%` }} />
            </div>
            {r.encerram.length > 0 && (
              <p className="text-[13px] text-[var(--rotulo-2)] mt-1.5">
                última parcela: {r.encerram.map((e) => e.nome).join(", ")}
              </p>
            )}
          </div>
        ))}
      </div>
      <p className="text-[13px] text-[var(--rotulo-2)] px-4 mb-6">
        A projeção usa só o que está lançado. Compras novas entram por cima.
      </p>

      <LinhaInstalar />

      <h3 className="text-[13px] uppercase tracking-wide text-[var(--rotulo-2)] mb-1.5 ml-4">
        backup
      </h3>
      <div className="bg-[var(--cartao)] rounded-xl overflow-hidden lista-ios">
        <button onClick={onExportar}
          className="w-full text-left px-4 min-h-[44px] py-3 text-[17px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--destaque)]">
          Baixar JSON
        </button>
        <button onClick={onExportarCsv}
          className="w-full text-left px-4 min-h-[44px] py-3 text-[17px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--destaque)]">
          Baixar CSV
        </button>
        <label className="block px-4 min-h-[44px] py-3 text-[17px] cursor-pointer focus-within:ring-2 focus-within:ring-inset focus-within:ring-[var(--destaque)]">
          Restaurar
          <input type="file" accept="application/json" className="sr-only" onChange={onImportar} />
        </label>
      </div>
      <p className="text-[13px] text-[var(--rotulo-2)] px-4 mt-2 leading-relaxed">
        Os dados já ficam salvos no servidor. O JSON guarda o caderno inteiro —
        mês atual, meses fechados e planejados — e restaurar troca tudo pelo que
        estiver no arquivo. O CSV é só para abrir em planilha.
      </p>
    </div>
  );
}
