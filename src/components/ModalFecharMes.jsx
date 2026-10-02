import AlertaIOS from "./AlertaIOS";

// O texto muda conforme o que já existe no mês seguinte: nada, um plano (só o
// que foi lançado adiantado) ou um retrato (o mês inteiro, de quando já foi o
// atual).
export default function ModalFecharMes({ mesAtual, proximoMes, somaAoPlano, adotaRetrato, onConfirmar, onCancelar }) {
  return (
    <AlertaIOS
      titulo={`Fechar ${mesAtual}?`}
      texto={
        (adotaRetrato
          ? `O mês vira ${proximoMes}, do jeito que ele já estava gravado.`
          : somaAoPlano
            ? `Cada parcela avança uma casa e o mês vira ${proximoMes}, junto com o que você já lançou nele.`
            : `Cada parcela avança uma casa e o mês vira ${proximoMes}.`) +
        ` Dá pra voltar em ${mesAtual} depois pela seta, se precisar.`
      }
      acao="Fechar mês"
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}
