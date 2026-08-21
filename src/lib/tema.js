import { useEffect, useState } from "react";

const CHAVE = "tema";

const preferenciaSistema = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";

export function useTema() {
  const [tema, setTema] = useState(() => {
    try {
      return localStorage.getItem(CHAVE) || preferenciaSistema();
    } catch {
      return preferenciaSistema();
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", tema === "escuro");
    document.querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", tema === "escuro" ? "#1c1917" : "#f5f5f4");
    try {
      localStorage.setItem(CHAVE, tema);
    } catch {
      // Sem localStorage (modo privado etc.) — tema só não persiste entre sessões.
    }
  }, [tema]);

  const alternar = () => setTema((t) => (t === "escuro" ? "claro" : "escuro"));

  return [tema, alternar];
}
