import { brl, ehAVista } from "../lib/caderno";

// Um item `herdado` vem de outro mês — a tela de um mês à frente mostra, mas
// editar ou apagar é no mês de origem. A parcela já chega na casa do mês.
export default function Secao({ titulo, itens, onEditar, onRemover, readOnly = false }) {
  if (itens.length === 0) return null;
  return (
    <section className="mb-5">
      <h2 className="text-[13px] uppercase tracking-wide text-[var(--rotulo-2)] mb-1.5 ml-4">
        {titulo}
      </h2>
      <div className="bg-[var(--cartao)] rounded-xl overflow-hidden lista-ios">
        {itens.map((it) => {
          // À vista é parcela única no banco. Mostrar "01/01 · última" ali só
          // confundiria: o título da seção já diz o que ela é.
          const contaParcela = it.tipo === "parcelado" && !ehAVista(it);
          const resta = contaParcela ? it.total - it.paga : null;
          const soLeitura = readOnly || it.herdado;
          const detalhes = (
            <>
              <div className="text-[17px] leading-tight">{it.nome}</div>
              {contaParcela && (
                <div className="text-[13px] text-[var(--rotulo-2)] tabular mt-0.5">
                  {String(it.paga).padStart(2, "0")}/{String(it.total).padStart(2, "0")}
                  {resta === 0 ? " · última" : ` · faltam ${resta}`}
                </div>
              )}
            </>
          );
          return (
            <div key={it.id} className="flex items-center gap-3 px-4 min-h-[44px] py-2.5">
              {soLeitura ? (
                <div className="flex-1">{detalhes}</div>
              ) : (
                <button onClick={() => onEditar({ ...it })}
                  className="flex-1 text-left rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
                  {detalhes}
                </button>
              )}
              <span className="text-[17px] tabular">{brl(it.valor)}</span>
              {!soLeitura && (
                <button onClick={() => onRemover(it.id)} aria-label={`Remover ${it.nome}`}
                  className="w-11 h-11 -mr-2 shrink-0 grid place-items-center text-[22px] leading-none text-[var(--rotulo-3)] rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
                  ×
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
