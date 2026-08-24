// O alerta de confirmação do iOS: caixa centralizada, título curto, texto de
// apoio menor, e os botões separados por régua — cancelar em peso normal,
// a ação em negrito (ou em vermelho, quando apaga alguma coisa).
export default function AlertaIOS({
  titulo,
  texto,
  acao,
  destrutiva = false,
  onConfirmar,
  onCancelar,
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center px-10"
         style={{ background: "var(--sombra-modal)" }}
         onClick={onCancelar}>
      <div role="alertdialog" aria-modal="true" aria-label={titulo}
           onClick={(e) => e.stopPropagation()}
           className="w-full max-w-[270px] rounded-2xl overflow-hidden bg-[var(--cartao)] text-center">
        <div className="px-4 pt-5 pb-4">
          <h2 className="text-[17px] font-semibold mb-1">{titulo}</h2>
          <p className="text-[13px] text-[var(--rotulo-2)] leading-snug">{texto}</p>
        </div>
        <div className="grid grid-cols-2 border-t border-[var(--separador)]">
          <button onClick={onCancelar}
            className="py-3 text-[17px] border-r border-[var(--separador)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--destaque)]">
            Cancelar
          </button>
          <button onClick={onConfirmar}
            className="py-3 text-[17px] font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--destaque)]"
            style={destrutiva ? { color: "var(--perigo)" } : undefined}>
            {acao}
          </button>
        </div>
      </div>
    </div>
  );
}
