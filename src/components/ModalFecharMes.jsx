export default function ModalFecharMes({ mesAtual, proximoMes, onConfirmar, onCancelar }) {
  return (
    <div className="fixed inset-0 bg-stone-900 bg-opacity-40 flex items-end sm:items-center justify-center z-10">
      <div className="bg-stone-100 w-full max-w-lg p-5">
        <h2 className="text-xl lowercase mb-3" style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          fechar {mesAtual}?
        </h2>
        <p className="text-sm text-stone-600 mb-5">
          Cada parcela avança uma casa e o mês vira {proximoMes}.
          Não dá pra desfazer.
        </p>
        <div className="flex gap-3">
          <button onClick={onConfirmar}
            className="flex-1 bg-stone-900 text-stone-50 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800">
            fechar mês
          </button>
          <button onClick={onCancelar}
            className="px-5 border border-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-800">
            cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
