// Sobe o app de verdade trocando só `src/supabase.js` pelo banco de mentira.
// Tudo o mais — tela, regras, repositório — é o código que vai pra produção.

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../..", import.meta.url));
const falso = fileURLToPath(new URL("./supabase.js", import.meta.url));

export default defineConfig({
  root: raiz,
  plugins: [
    {
      name: "banco-de-mentira",
      enforce: "pre",
      resolveId(id, quemImporta) {
        const doApp = quemImporta && !quemImporta.includes("node_modules");
        if (doApp && /^\.{1,2}\/supabase(\.js)?$/.test(id)) return falso;
      },
    },
    react(),
    tailwindcss(),
  ],
  server: { port: 5199, strictPort: true },
  logLevel: "warn",
});
