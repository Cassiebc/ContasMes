// Sheet do iOS: sobe de baixo, cantos arredondados no topo, alça de arrastar.
// Os campos ficam num cartão agrupado, como em Ajustes.
export default function FormConta({ form, setForm, onGravar, onCancelar }) {
  const campo =
    "w-full bg-transparent text-[17px] text-right tabular placeholder:text-[var(--rotulo-3)] focus:outline-none";

  return (
    <div className="fixed inset-0 z-20 flex items-end sm:items-center justify-center"
         style={{ background: "var(--sombra-modal)" }}
         onClick={onCancelar}>
      <div role="dialog" aria-modal="true" aria-label={form.id ? "Editar conta" : "Nova conta"}
           onClick={(e) => e.stopPropagation()}
           className="w-full max-w-lg bg-[var(--fundo)] rounded-t-2xl sm:rounded-2xl max-h-full overflow-y-auto"
           style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}>

        <div className="pt-2 pb-1 grid place-items-center">
          <div className="w-9 h-1 rounded-full bg-[var(--rotulo-3)]" />
        </div>

        <div className="flex items-center justify-between px-4 py-2">
          <button onClick={onCancelar}
            className="text-[17px] px-2 py-1 -ml-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
            Cancelar
          </button>
          <h2 className="text-[17px] font-semibold">
            {form.id ? "Editar conta" : "Nova conta"}
          </h2>
          <button onClick={onGravar}
            className="text-[17px] font-semibold px-2 py-1 -mr-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
            Salvar
          </button>
        </div>

        <div className="px-4 pb-4">
          <div className="bg-[var(--cartao)] rounded-xl overflow-hidden lista-ios mb-5">
            <div className="flex items-center gap-3 px-4 min-h-[44px] py-2">
              <label htmlFor="nome" className="text-[17px] shrink-0">Nome</label>
              <input id="nome" value={form.nome} placeholder="Aluguel"
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className={campo + " text-left"} style={{ textAlign: "right" }} />
            </div>
            <div className="flex items-center gap-3 px-4 min-h-[44px] py-2">
              <label htmlFor="valor" className="text-[17px] shrink-0">Valor</label>
              <input id="valor" value={form.valor} inputMode="decimal" placeholder="0,00"
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                className={campo} />
            </div>
          </div>

          <div className="flex gap-0.5 bg-[var(--preenchido)] rounded-lg p-0.5 mb-5">
            {[["fixo", "Todo mês"], ["parcelado", "Parcelado"]].map(([k, r]) => (
              <button key={k} onClick={() => setForm({ ...form, tipo: k })}
                aria-pressed={form.tipo === k}
                className={`flex-1 py-1.5 text-[13px] rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)] ${
                  form.tipo === k
                    ? "bg-[var(--cartao)] font-semibold shadow-sm"
                    : "text-[var(--rotulo-2)]"}`}>
                {r}
              </button>
            ))}
          </div>

          {form.tipo === "parcelado" && (
            <div className="bg-[var(--cartao)] rounded-xl overflow-hidden lista-ios">
              <div className="flex items-center gap-3 px-4 min-h-[44px] py-2">
                <label htmlFor="paga" className="text-[17px] shrink-0">Já paguei</label>
                <input id="paga" value={form.paga} inputMode="numeric"
                  onChange={(e) => setForm({ ...form, paga: e.target.value })}
                  className={campo} />
              </div>
              <div className="flex items-center gap-3 px-4 min-h-[44px] py-2">
                <label htmlFor="total" className="text-[17px] shrink-0">De quantas</label>
                <input id="total" value={form.total} inputMode="numeric"
                  onChange={(e) => setForm({ ...form, total: e.target.value })}
                  className={campo} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
