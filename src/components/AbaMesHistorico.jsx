import Secao from "./Secao";
import CardTotal from "./CardTotal";
import { ehAVista } from "../lib/caderno";

export default function AbaMesHistorico({ entry, onEditar, onRemover }) {
  const soma = (lista) => lista.reduce((s, it) => s + it.valor, 0);
  const fixos = entry.itens.filter((i) => i.tipo === "fixo");
  const parcelados = entry.itens.filter((i) => i.tipo === "parcelado" && !ehAVista(i));
  const aVista = entry.itens.filter(ehAVista);
  const totalFixos = soma(fixos);
  const totalParcelados = soma(parcelados);
  const totalAVista = soma(aVista);
  const totalMes = totalFixos + totalParcelados + totalAVista;

  return (
    <>
      <CardTotal total={totalMes} fixos={totalFixos} parcelado={totalParcelados}
                 aVista={totalAVista} />
      {entry.itens.length === 0 ? (
        <div className="bg-[var(--cartao)] rounded-xl px-5 py-8 text-center">
          <p className="text-[17px] mb-1">Esse mês não teve lançamentos.</p>
          <p className="text-[13px] text-[var(--rotulo-2)] leading-relaxed">
            Toque em <span className="text-[var(--rotulo)]">lançar conta</span> pra
            adicionar algo aqui — fica só nesse mês, não mexe no atual.
          </p>
        </div>
      ) : (
        <>
          <Secao titulo="fixos" itens={fixos} offset={0} onEditar={onEditar} onRemover={onRemover} />
          <Secao titulo="parcelado" itens={parcelados} offset={0} onEditar={onEditar} onRemover={onRemover} />
          <Secao titulo="à vista" itens={aVista} offset={0} onEditar={onEditar} onRemover={onRemover} />
        </>
      )}
    </>
  );
}
