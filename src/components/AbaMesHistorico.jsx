import Secao from "./Secao";
import CardTotal from "./CardTotal";

export default function AbaMesHistorico({ entry }) {
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
          <p className="text-sm text-stone-600">Esse mês não teve lançamentos.</p>
        </div>
      ) : (
        <>
          <Secao titulo="fixos" itens={fixos} offset={0} readOnly />
          <Secao titulo="parcelado" itens={parcelados} offset={0} readOnly />
        </>
      )}
    </>
  );
}
