// O "Supabase" que o app enxerga quando roda pelos testes de `e2e/local/`.
//
// É o banco de mentira de `src/lib/bancoFalso.js` com uma sessão já aberta, e
// vive na memória da aba: recarregar a página zera tudo. Nada daqui chega ao
// Supabase de verdade — é o que permite dirigir a tela real sem conta de teste
// e sem tocar em produção.
//
// O banco fica pendurado em `window.__banco` pra o teste conferir o que foi
// gravado, em vez de acreditar na tela.

import { criarBancoFalso } from "../../src/lib/bancoFalso.js";

const banco = criarBancoFalso();
window.__banco = banco;

const sessao = { user: { id: "usuaria-local", email: "teste@local" } };

export const supabase = {
  from: (tabela) => banco.from(tabela),
  auth: {
    getSession: async () => ({ data: { session: sessao } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
  },
};
