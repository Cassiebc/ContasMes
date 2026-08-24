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
    <div className="min-h-screen flex flex-col justify-center px-4 py-10"
         style={{ background: "var(--fundo)", color: "var(--rotulo)" }}>
      <div className="w-full max-w-sm mx-auto">
        <div className="flex justify-between items-center mb-1 min-h-[44px]">
          <p className="text-[13px] text-[var(--rotulo-2)]">Caderno de Contas</p>
          <BotaoTema tema={tema} onAlternar={onAlternarTema} />
        </div>

        <h1 className="text-[34px] font-bold tracking-tight leading-none mb-6">
          {modo === "entrar" ? "Entrar" : "Criar conta"}
        </h1>

        <div className="bg-[var(--cartao)] rounded-xl overflow-hidden lista-ios mb-4">
          <div className="flex items-center gap-3 px-4 min-h-[44px] py-2">
            <label htmlFor="email" className="text-[17px] shrink-0 w-[74px]">E-mail</label>
            <input id="email" type="email" value={email} autoComplete="email"
              autoCapitalize="none" autoCorrect="off" placeholder="voce@exemplo.com"
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-transparent text-[17px] placeholder:text-[var(--rotulo-3)] focus:outline-none" />
          </div>
          <div className="flex items-center gap-3 px-4 min-h-[44px] py-2">
            <label htmlFor="senha" className="text-[17px] shrink-0 w-[74px]">Senha</label>
            <input id="senha" type="password" value={senha}
              autoComplete={modo === "entrar" ? "current-password" : "new-password"}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && enviar()}
              className="w-full bg-transparent text-[17px] placeholder:text-[var(--rotulo-3)] focus:outline-none" />
          </div>
        </div>

        {msg && (
          <div className="mb-4 rounded-xl bg-[var(--cartao)] px-4 py-3 text-[13px] leading-snug"
               style={msg.tipo === "erro" ? { color: "var(--perigo)" } : undefined}>
            {msg.texto}
          </div>
        )}

        <button onClick={enviar} disabled={ocupado}
          className="w-full py-3.5 rounded-xl text-[17px] font-semibold disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--destaque)]"
          style={{ background: "var(--destaque)", color: "var(--sobre-destaque)" }}>
          {ocupado ? "…" : modo === "entrar" ? "Entrar" : "Criar conta"}
        </button>

        <button
          onClick={() => { setModo(modo === "entrar" ? "criar" : "entrar"); setMsg(null); }}
          className="w-full mt-4 min-h-[44px] text-[15px] text-[var(--rotulo-2)] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--destaque)]">
          {modo === "entrar" ? "Não tenho conta ainda" : "Já tenho conta"}
        </button>
      </div>
    </div>
  );
}
