import AlertaIOS from "./AlertaIOS";

export default function ModalAbrirMes({ mesAlvo, mesAtual, onConfirmar, onCancelar }) {
  return (
    <AlertaIOS
      titulo={`Abrir ${mesAlvo}?`}
      texto={`${mesAlvo} vira o mês atual. ${mesAtual} e tudo que estiver entre ele e ${mesAlvo} viram meses futuros planejados — continuam existindo e editáveis.`}
      acao="Abrir mês"
      onConfirmar={onConfirmar}
      onCancelar={onCancelar}
    />
  );
}
