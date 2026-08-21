import React, { useState } from "react";
import { supabase } from "./supabase";
import BotaoTema from "./components/BotaoTema.jsx";

const traduzirErro = (msg) => {
  const mapa = {
    "Invalid login credentials": "E-mail ou senha não conferem.",
    "User already registered": "Esse e-mail já tem conta. Tente entrar.",
    "Email not confirmed": "Confirme o e-mail que enviamos antes de entrar.",
    "Password should be at least 6 characters": "A senha precisa ter pelo menos 6 caracteres.",
  };
  if (mapa[msg]) return mapa[msg];
  if (/email address .* is invalid/i.test(msg)) return "Esse e-mail não parece válido.";
  if (/rate limit/i.test(msg)) return "Muitas tentativas em pouco tempo. Espere um pouco e tente de novo.";
  if (/failed to fetch|network/i.test(msg)) return "Sem conexão com o servidor. Verifique a internet e tente de novo.";
  return msg;
};

export default function Login({ tema, onAlternarTema }) {
  const [modo, setModo] = useState("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  const enviar = async () => {
    setMsg(null);
    if (!email.trim() || !senha) {
      setMsg({ tipo: "erro", texto: "Preencha e-mail e senha." });
      return;
    }
    if (modo === "criar" && senha.length < 8) {
      setMsg({ tipo: "erro", texto: "A senha precisa de pelo menos 8 caracteres." });
      return;
    }
    setOcupado(true);
    try {
      const fn = modo === "entrar" ? "signInWithPassword" : "signUp";
      const { error } = await supabase.auth[fn]({ email: email.trim(), password: senha });
      if (error) {
        setMsg({ tipo: "erro", texto: traduzirErro(error.message) });
        return;
      }
      if (modo === "criar") {
        setMsg({
          tipo: "ok",
          texto: "Conta criada. Se pedirem confirmação, abra o e-mail que enviamos.",
        });
      }
    } catch (e) {
      setMsg({ tipo: "erro", texto: traduzirErro(e?.message || String(e)) });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 flex items-center justify-center px-5"
         style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
      <div className="w-full max-w-sm">
        <div className="flex justify-between items-baseline">
          <p className="text-[10px] uppercase tracking-[0.3em] text-stone-500 dark:text-stone-400">
            caderno de contas
          </p>
          <BotaoTema tema={tema} onAlternar={onAlternarTema} />
        </div>
        <h1 className="text-3xl lowercase mt-2 mb-8"
            style={{ fontFamily: "ui-serif, Georgia, serif" }}>
          {modo === "entrar" ? "entrar" : "criar conta"}
        </h1>

        <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-1">
          e-mail
        </label>
        <input type="email" value={email} autoComplete="email"
          autoCapitalize="none" autoCorrect="off"
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border border-stone-400 dark:border-stone-600 bg-transparent px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300" />

        <label className="block text-[10px] uppercase tracking-[0.2em] text-stone-500 dark:text-stone-400 mb-1">
          senha
        </label>
        <input type="password" value={senha}
          autoComplete={modo === "entrar" ? "current-password" : "new-password"}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && enviar()}
          className="w-full border border-stone-400 dark:border-stone-600 bg-transparent px-3 py-2 mb-5 focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300" />

        {msg && (
          <div className={`mb-4 border-l-2 px-3 py-2 text-sm bg-stone-200 dark:bg-stone-800 ${
            msg.tipo === "erro"
              ? "border-stone-800 dark:border-stone-200"
              : "border-stone-500 dark:border-stone-400"}`}>
            {msg.texto}
          </div>
        )}

        <button onClick={enviar} disabled={ocupado}
          className="w-full bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 py-3 text-sm tracking-wide disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-stone-800 dark:focus:ring-stone-300">
          {ocupado ? "..." : modo === "entrar" ? "entrar" : "criar conta"}
        </button>

        <button
          onClick={() => { setModo(modo === "entrar" ? "criar" : "entrar"); setMsg(null); }}
          className="w-full mt-4 text-sm text-stone-500 dark:text-stone-400 underline focus:outline-none focus:ring-2 focus:ring-stone-800 dark:focus:ring-stone-300">
          {modo === "entrar" ? "não tenho conta ainda" : "já tenho conta"}
        </button>
      </div>
    </div>
  );
}
