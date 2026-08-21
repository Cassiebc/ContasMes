import Secao from "./Secao";
import CardTotal from "./CardTotal";

export default function AbaMesHistorico({ entry, onEditar, onRemover }) {
  const fixos = entry.itens.filter((i) => i.tipo === "fixo");
  const parcelados = entry.itens.filter((i) => i.tipo === "parcelado");
  const totalFixos = fixos.reduce((s, it) => s + it.valor, 0);
  const totalParcelados = parcelados.reduce((s, it) => s + it.valor, 0);
  const totalMes = totalFixos + totalParcelados;

  return (
    <>
      <CardTotal total={totalMes} fixos={totalFixos} parcelado={totalParcelados} />
      {entry.itens.length === 0 ? (
        <div className="border border-stone-300 border-dashed p-6 text-center">
          <p className="text-sm text-stone-600 mb-1">Esse mês não teve lançamentos.</p>
          <p className="text-xs text-stone-500">
            Toque em <span className="text-stone-800">lançar conta</span> pra
            adicionar algo aqui — fica só nesse mês, não mexe no atual.
          </p>
        </div>
      ) : (
        <>
          <Secao titulo="fixos" itens={fixos} offset={0} onEditar={onEditar} onRemover={onRemover} />
          <Secao titulo="parcelado" itens={parcelados} offset={0} onEditar={onEditar} onRemover={onRemover} />
        </>
      )}
    </>
  );
}
