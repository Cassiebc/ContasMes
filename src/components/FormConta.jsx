export default function FormConta({ form, setForm, onGravar, onCancelar }) {
  return (
    <div className="fixed inset-0 bg-stone-900 bg-opacity-40 flex items-end sm:items-center justify-center z-10">
      <div className="bg-stone-100 dark:bg-stone-900 dark:text-stone-100 w-full max-w-lg p-5 max-h-full overflow-y-auto">
        <h2 className="text-xl lowercase mb-4" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          {form.id ? "editar conta" : "nova conta"}
        </h2>

        <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-1">nome</label>
        <input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })}
          className="w-full border border-stone-400 dark:border-stone-600 bg-transparent px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300" />

        <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-1">valor da parcela</label>
        <input value={form.valor} inputMode="decimal" placeholder="0,00"
          onChange={(e) => setForm({ ...form, valor: e.target.value })}
          className="w-full border border-stone-400 dark:border-stone-600 bg-transparent px-3 py-2 mb-4 tabular-nums focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300" />

        <div className="flex gap-2 mb-4">
          {[["fixo", "todo mês"], ["parcelado", "parcelado"]].map(([k, r]) => (
            <button key={k} onClick={() => setForm({ ...form, tipo: k })}
              className={`flex-1 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300 ${
                form.tipo === k
                  ? "bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 border-stone-900 dark:border-stone-100"
                  : "border-stone-400 dark:border-stone-600"}`}>
              {r}
            </button>
          ))}
        </div>

        {form.tipo === "parcelado" && (
          <div className="flex gap-3 mb-4">
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-1">já paguei</label>
              <input value={form.paga} inputMode="numeric"
                onChange={(e) => setForm({ ...form, paga: e.target.value })}
                className="w-full border border-stone-400 dark:border-stone-600 bg-transparent px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-1">de quantas</label>
              <input value={form.total} inputMode="numeric"
                onChange={(e) => setForm({ ...form, total: e.target.value })}
                className="w-full border border-stone-400 dark:border-stone-600 bg-transparent px-3 py-2 tabular-nums focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300" />
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onGravar}
            className="flex-1 bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
            gravar
          </button>
          <button onClick={onCancelar}
            className="px-5 border border-stone-400 dark:border-stone-600 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
            cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
