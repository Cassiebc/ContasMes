import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { vigiarAtualizacoes } from "./lib/atualizacao.js";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// Em dev o Vite já recarrega sozinho; isto é pro app publicado.
if (import.meta.env.PROD) vigiarAtualizacoes();
