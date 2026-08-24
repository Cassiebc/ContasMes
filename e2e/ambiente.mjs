// Configuração compartilhada dos testes de ponta a ponta.
//
// Nada de credencial no repositório: tudo vem do ambiente. Veja o
// `e2e/README.md` para como preencher.

import fs from 'fs';
import path from 'path';

// Lê o .env da raiz sem depender de biblioteca — o Vite usa esse mesmo
// arquivo, então as chaves do Supabase já estão lá.
const carregarEnv = () => {
  const arquivo = path.join(process.cwd(), '.env');
  if (!fs.existsSync(arquivo)) return;
  for (const linha of fs.readFileSync(arquivo, 'utf8').split('\n')) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
};
carregarEnv();

const exigir = (nome, dica) => {
  const v = process.env[nome];
  if (!v) {
    console.error(`\nFalta a variável ${nome}.\n${dica}\n`);
    process.exit(2);
  }
  return v;
};

export const APP = process.env.E2E_URL || 'http://localhost:5173';

export const SUPABASE_URL = exigir('VITE_SUPABASE_URL', 'Cadastre no .env da raiz (veja .env.example).');
export const SUPABASE_KEY = exigir('VITE_SUPABASE_ANON_KEY', 'Cadastre no .env da raiz (veja .env.example).');

export const EMAIL = exigir('E2E_EMAIL',
  'É o e-mail da conta de teste. NÃO use a sua conta real:\n' +
  'estes testes apagam e recriam os meses do usuário a cada execução.');
export const SENHA = exigir('E2E_SENHA', 'É a senha da conta de teste.');
