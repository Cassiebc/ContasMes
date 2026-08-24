import { useState } from "react";
import { useInstalacao } from "../lib/instalacao";
import AlertaIOS from "./AlertaIOS.jsx";

const CHAVE = "caderno:aviso-instalar-dispensado";

// localStorage falha em aba anônima e com cookies bloqueados; o aviso é
// dispensável, não essencial, então uma falha aqui não pode derrubar a tela.
const leu = () => {
  try { return localStorage.getItem(CHAVE) === "1"; } catch { return false; }
};
const guardar = () => {
  try { localStorage.setItem(CHAVE, "1"); } catch { /* segue sem lembrar */ }
};

// No iPhone o Safari não deixa o site abrir o convite de instalação: o
// caminho é manual, pelo botão de compartilhar. Só dá pra ensinar.
const PASSO_A_PASSO =
  'Toque em Compartilhar na barra do Safari e escolha "Adicionar à Tela de Início".';

function useInstalarComExplicacao() {
  const { podeInstalar, precisaExplicar, instalar } = useInstalacao();
  const [explicando, setExplicando] = useState(false);

  const explicacao = explicando ? (
    <AlertaIOS
      titulo="Instalar no iPhone"
      texto={PASSO_A_PASSO}
      acao="Entendi"
      onConfirmar={() => setExplicando(false)}
      onCancelar={() => setExplicando(false)}
    />
  ) : null;

  return {
    disponivel: podeInstalar || precisaExplicar,
    acionar: () => (podeInstalar ? instalar() : setExplicando(true)),
    explicacao,
  };
}

// Aviso na tela principal: aparece uma vez, some quando dispensado ou
// instalado, e nunca mais volta a incomodar.
export function AvisoInstalar() {
  const { disponivel, acionar, explicacao } = useInstalarComExplicacao();
  const [dispensado, setDispensado] = useState(leu);

  if (!disponivel || dispensado) return explicacao;

  return (
    <>
      <div className="mb-4 rounded-xl bg-[var(--cartao)] px-4 py-3">
        <div className="flex justify-between items-start gap-3">
          <span className="text-[13px] text-[var(--rotulo-2)] leading-snug">
            Dá para instalar o caderno no celular e abrir direto da tela
            inicial, sem passar pelo navegador.
          </span>
          <button onClick={() => { setDispensado(true); guardar(); }}
            aria-label="Dispensar aviso de instalação"
            className="w-8 h-8 -mr-1 -mt-1 shrink-0 grid place-items-center text-[20px] leading-none text-[var(--rotulo-3)] rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
            ×
          </button>
        </div>
        <button onClick={acionar}
          className="mt-2 text-[13px] font-semibold rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
          Instalar
        </button>
      </div>
      {explicacao}
    </>
  );
}

// Linha fixa em "projeção": para quem dispensou o aviso e depois mudou de
// ideia. Some só quando o app já está instalado.
export function LinhaInstalar() {
  const { disponivel, acionar, explicacao } = useInstalarComExplicacao();

  if (!disponivel) return null;

  return (
    <>
      <h3 className="text-[13px] uppercase tracking-wide text-[var(--rotulo-2)] mb-1.5 ml-4">
        app
      </h3>
      <div className="bg-[var(--cartao)] rounded-xl overflow-hidden mb-2">
        <button onClick={acionar}
          className="w-full text-left px-4 min-h-[44px] py-3 text-[17px] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--destaque)]">
          Instalar na tela inicial
        </button>
      </div>
      <p className="text-[13px] text-[var(--rotulo-2)] px-4 mb-6 leading-relaxed">
        Abre em tela cheia, sem a barra do navegador. É o mesmo caderno e a
        mesma conta — nada é baixado duas vezes.
      </p>
      {explicacao}
    </>
  );
}
