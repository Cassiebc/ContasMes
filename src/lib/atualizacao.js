// O app instalado na tela inicial não "abre de novo" quando você volta pra
// ele: retoma com o JavaScript que baixou da primeira vez, e pode ficar dias
// assim mesmo depois de um deploy. Aqui a gente compara o bundle que está
// rodando com o que o servidor está entregando agora, e recarrega quando sai
// versão nova.
//
// A checagem acontece ao voltar pro app — momento em que ninguém está no meio
// de digitar, então recarregar não atrapalha. Não dá pra depender do service
// worker pra isso: o sw.js é o mesmo arquivo em todo deploy, então o
// navegador nunca o considera "novo".

const bundleEmUso = () =>
  document.querySelector('script[type="module"][src]')?.src || null;

async function bundlePublicado() {
  const res = await fetch("/index.html", { cache: "no-store" });
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);
  return m ? new URL(m[1], location.origin).href : null;
}

export function vigiarAtualizacoes() {
  const emUso = bundleEmUso();
  if (!emUso) return;

  let checando = false;

  const checar = async () => {
    if (checando || document.visibilityState !== "visible") return;
    checando = true;
    let precisaAtualizar = false;
    try {
      const publicado = await bundlePublicado();
      precisaAtualizar = !!publicado && publicado !== emUso;
    } catch {
      // Sem internet ou resposta inesperada: segue com a versão atual e
      // tenta de novo na próxima vez que o app voltar pro foco.
    } finally {
      checando = false;
    }
    if (!precisaAtualizar) return;

    // Limpar o cache é só faxina pra não reaparecer arquivo antigo; se
    // falhar (modo privado, por exemplo) o recarregamento tem que
    // acontecer do mesmo jeito.
    try {
      if ("caches" in window) {
        const chaves = await caches.keys();
        await Promise.all(chaves.map((k) => caches.delete(k)));
      }
    } catch {
      // segue para o reload mesmo assim
    }
    location.reload();
  };

  document.addEventListener("visibilitychange", checar);
  window.addEventListener("focus", checar);
}
