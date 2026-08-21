import Secao from "./Secao";
import CardTotal from "./CardTotal";

export default function AbaMes({
  offset,
  totalMes, somaFixosMes, somaParcelasMes,
  itensDoMes, onEditar, onRemover,
}) {
  return (
    <>
      <CardTotal total={totalMes} fixos={somaFixosMes} parcelado={somaParcelasMes} />

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
