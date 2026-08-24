import Secao from "./Secao";
import CardTotal from "./CardTotal";

export default function AbaMes({
  offset,
  totalMes, somaFixosMes, somaParcelasMes,
  itensDoMes, onEditar, onRemover,
  nomeDoMes, passado = false,
}) {
  return (
    <>
      <CardTotal total={totalMes} fixos={somaFixosMes} parcelado={somaParcelasMes} />

      {itensDoMes.length === 0 ? (
        <div className="bg-[var(--cartao)] rounded-xl px-5 py-8 text-center">
          {/* Num mês do passado o caderno não está em branco — só esse mês
              está. Dizer "caderno em branco" ali assustaria à toa. */}
          <p className="text-[17px] mb-1">
            {passado ? `Nada lançado em ${nomeDoMes}.` : "Caderno em branco."}
          </p>
          <p className="text-[13px] text-[var(--rotulo-2)] leading-relaxed">
            {passado ? (
              <>
                Toque em <span className="text-[var(--rotulo)]">lançar conta</span> para
                registrar o que você pagou nesse mês. O mês atual não muda.
              </>
            ) : (
              <>
                Toque em <span className="text-[var(--rotulo)]">lançar conta</span> para
                começar. Contas de todo mês entram como fixas; compras no cartão,
                como parceladas.
              </>
            )}
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
