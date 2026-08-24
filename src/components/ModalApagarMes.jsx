import { brl } from "../lib/caderno";

export default function ModalApagarMes({ mes, ano, total, onConfirmar, onCancelar }) {
  return (
    <div className="fixed inset-0 bg-stone-900 bg-opacity-40 flex items-end sm:items-center justify-center z-10">
      <div className="bg-stone-100 dark:bg-stone-900 dark:text-stone-100 w-full max-w-lg p-5">
        <h2 className="text-xl lowercase mb-3" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          apagar {mes} {ano}?
        </h2>
        <p className="text-sm text-stone-600 dark:text-stone-300 mb-5">
          Esse mês fechado, com {brl(total)} em lançamentos, sai do histórico
          de vez. O mês atual e os outros meses não mudam.
        </p>
        <div className="flex gap-3">
          <button onClick={onConfirmar}
            className="flex-1 bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
            apagar
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
