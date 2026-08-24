import { brl } from "../lib/caderno";
import AlertaIOS from "./AlertaIOS";

export default function ModalApagarMes({ mes, ano, total, planejado = false, onConfirmar, onCancelar }) {
  return (
    <AlertaIOS
      titulo={`${planejado ? "Descartar" : "Apagar"} ${mes} ${ano}?`}
      texto={
        planejado
          ? `O planejamento desse mês, com ${brl(total)} em lançamentos, é descartado. ${mes} volta a aparecer na projeção calculada a partir do mês atual.`
          : `Esse mês fechado, com ${brl(total)} em lançamentos, sai do histórico de vez. O mês atual e os outros meses não mudam.`
      }
      acao={planejado ? "Descartar" : "Apagar"}
      destrutiva
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}
