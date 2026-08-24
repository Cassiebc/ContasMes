import { useEffect, useState } from "react";

// O Chrome (Android e desktop) avisa que dá pra instalar disparando
// `beforeinstallprompt` — mas dispara cedo, muitas vezes antes do React
// montar. Por isso o evento é capturado assim que este módulo carrega e fica
// guardado aqui; o hook só lê o que já foi guardado.
let convite = null;
const ouvintes = new Set();

const avisar = () => ouvintes.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();   // sem isso o Chrome mostra a barra dele por cima
    convite = e;
    avisar();
  });
  window.addEventListener("appinstalled", () => {
    convite = null;
    avisar();
  });
}

const jaInstalado = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  window.navigator.standalone === true;

// O Safari não tem `beforeinstallprompt`: no iPhone a instalação é manual,
// pelo botão de compartilhar. Só dá pra orientar.
const ehIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) ||
  // iPad recente se apresenta como Mac, mas tem toque
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export function useInstalacao() {
  const [, redesenhar] = useState(0);

  useEffect(() => {
    const f = () => redesenhar((n) => n + 1);
    ouvintes.add(f);
    return () => ouvintes.delete(f);
  }, []);

  const instalado = jaInstalado();

  return {
    // Chrome: dá pra abrir o convite do sistema.
    podeInstalar: !instalado && convite !== null,
    // iPhone: não dá; resta explicar o caminho.
    precisaExplicar: !instalado && convite === null && ehIOS(),
    instalado,
    instalar: async () => {
      if (!convite) return null;
      convite.prompt();
      const { outcome } = await convite.userChoice;
      convite = null;      // o convite só serve uma vez
      avisar();
      return outcome;      // "accepted" | "dismissed"
    },
  };
}
