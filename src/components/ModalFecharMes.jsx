import AlertaIOS from "./AlertaIOS";

export default function ModalFecharMes({ mesAtual, proximoMes, adotaFuturo, onConfirmar, onCancelar }) {
  return (
    <AlertaIOS
      titulo={`Fechar ${mesAtual}?`}
      texto={
        (adotaFuturo
          ? `O mês vira ${proximoMes}, usando os lançamentos que você já tinha planejado pra ele.`
          : `Cada parcela avança uma casa e o mês vira ${proximoMes}.`) +
        ` Dá pra voltar em ${mesAtual} depois pela seta, se precisar.`
      }
      acao="Fechar mês"
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}
