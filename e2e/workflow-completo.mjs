import { chromium } from 'playwright';
import { APP, EMAIL, SENHA, SUPABASE_URL, SUPABASE_KEY } from './ambiente.mjs';
import { login, ler, resetar } from './estado.mjs';
import fs from 'fs';


let passou = 0, falhou = 0;
const check = (l, c, extra = '') => {
  if (c) { passou++; console.log(`  OK  ${l}`); }
  else { falhou++; console.log(`  XX  ${l} ${extra}`); }
};
const chave = (r) => `${r.mesBase}/${r.anoBase}`;
const dups = (e) => {
  const t = [...e.historico.map(chave), chave(e.dados), ...e.futuro.map(chave)];
  return [...new Set(t.filter((c, i) => t.indexOf(c) !== i))];
};
const soma = (r) => r.itens.reduce((s, i) => s + i.valor, 0);

const { token, uid } = await login();
const SB = SUPABASE_URL;
const SBKEY = SUPABASE_KEY;
const hh = () => ({ apikey: SBKEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' });
async function criarMesVazio(mes, ano) {
  const r = await fetch(`${SB}/rest/v1/meses`, { method: 'POST',
    headers: { ...hh(), Prefer: 'return=representation' },
    body: JSON.stringify({ user_id: uid, ano, mes, atual: false }) });
  const j = await r.json();
  return j[0]?.id;
}
async function criarMesComItem(mes, ano, item) {
  const id = await criarMesVazio(mes, ano);
  await fetch(`${SB}/rest/v1/lancamentos`, { method: 'POST', headers: hh(),
    body: JSON.stringify({ mes_id: id, ...item, paga: null, total: null }) });
  return id;
}

await resetar(token, uid);

const browser = await chromium.launch();
const page = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true }).then((c) => c.newPage());
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

await page.goto(APP, { waitUntil: 'networkidle' });
await page.locator('#email').fill(EMAIL);
await page.locator('#senha').fill(SENHA);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();
await page.waitForSelector('text=/Lançar conta/i', { timeout: 20000 });

const titulo = () => page.locator('h1').first().innerText();
const irPara = async (aba) => { await page.getByRole('button', { name: aba, exact: true }).click(); await page.waitForTimeout(400); };
const seta = async (d) => { await page.getByRole('button', { name: d === '←' ? 'Mês anterior' : 'Próximo mês' }).click(); await page.waitForTimeout(400); };
const lancar = async (nome, valor, parcelado = null) => {
  await page.getByRole('button', { name: 'Lançar conta' }).click();
  await page.waitForTimeout(250);
  if (parcelado) await page.getByRole('button', { name: 'Parcelado' }).click();
  await page.locator('#nome').fill(nome);
  await page.locator('#valor').fill(String(valor));
  if (parcelado) {
    const n = page.locator('input[inputmode="numeric"]');
    await page.locator('#paga').fill(String(parcelado[0]));
    await page.locator('#total').fill(String(parcelado[1]));
  }
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(1100);
};
const fecharMesUI = async () => {
  await page.getByRole('button', { name: 'Fechar mês' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Fechar mês' }).last().click();
  await page.waitForTimeout(1400);
};
const abrirMesUI = async () => {
  await page.getByRole('button', { name: 'Abrir mês' }).click();
  await page.waitForTimeout(300);
  await page.getByRole('button', { name: 'Abrir mês' }).last().click();
  await page.waitForTimeout(1400);
};
const projecao = async () => {
  await irPara('projeção');
  const r = await page.evaluate(() =>
    [...document.querySelectorAll('.lista-ios > div')]
      .map((d) => {
        const t = d.textContent.replace(/\s+/g, ' ').trim();
        const m = t.match(/^([a-zç]+)\s+(\d{4})\s*R\$\s*([\d.,]+)/);
        return m ? { mes: m[1], valor: parseFloat(m[3].replace(/\./g, '').replace(',', '.')) } : null;
      })
      .filter(Boolean)
  );
  await irPara('o mês');
  return r;
};

console.log('\n########## 1. LANÇAR CONTAS ##########');
await lancar('aluguel', 550);
await lancar('Viagem', 250, [1, 3]);
let e = await ler(token);
check('mês atual é agosto', chave(e.dados) === '7/2026');
check('total do mês = 800', soma(e.dados) === 800, `(deu ${soma(e.dados)})`);
check('tela mostra R$ 800,00', (await page.locator('body').innerText()).includes('800,00'));

console.log('\n########## 2. PROJEÇÃO (o bug reportado) ##########');
let p = await projecao();
console.log('     ', p.map((x) => `${x.mes}=${x.valor}`).join('  '));
check('agosto = 800 (aluguel + viagem 1/3)', p[0]?.valor === 800, `(deu ${p[0]?.valor})`);
check('setembro = 800 (aluguel + viagem 2/3)', p[1]?.valor === 800, `(deu ${p[1]?.valor})`);
check('outubro = 800 (aluguel + viagem 3/3)', p[2]?.valor === 800, `(deu ${p[2]?.valor})`);
check('novembro = 550 (só aluguel, viagem acabou)', p[3]?.valor === 550, `(deu ${p[3]?.valor})`);
check('nenhum mês zerado indevidamente', !p.some((x) => x.valor === 0));

console.log('\n########## 3. FECHAR MÊS ##########');
await fecharMesUI();
e = await ler(token);
check('avançou para setembro', chave(e.dados) === '8/2026', `(deu ${chave(e.dados)})`);
check('agosto foi para o histórico', e.historico.length === 1 && chave(e.historico[0]) === '7/2026');
check('parcela avançou (viagem 2/3)', e.dados.itens.find((i) => i.nome === 'Viagem')?.paga === 2);
check('aluguel continua (fixo)', !!e.dados.itens.find((i) => i.nome === 'aluguel'));
check('sem duplicatas', dups(e).length === 0, JSON.stringify(dups(e)));

console.log('\n########## 4. NAVEGAR E EDITAR MÊS FECHADO ##########');
await seta('←');
check('seta ← chegou em agosto', (await titulo()).includes('agosto'));
check('mostra aviso de mês fechado', (await page.locator('body').innerText()).includes('Mês fechado'));
await lancar('Farmácia', 30);
e = await ler(token);
check('item entrou no mês fechado', soma(e.historico[0]) === 830, `(deu ${soma(e.historico[0])})`);
check('mês atual NÃO foi afetado', soma(e.dados) === 800, `(deu ${soma(e.dados)})`);
check('sem duplicatas', dups(e).length === 0);

console.log('\n########## 5. ABRIR MÊS A PARTIR DO HISTÓRICO ##########');
await irPara('histórico');
const linhasHist = await page.evaluate(() =>
  [...document.querySelectorAll('button')].filter((b) => /20\d\d/.test(b.textContent) && b.textContent.includes('R$')).length
);
check('histórico lista 1 mês', linhasHist === 1, `(listou ${linhasHist})`);
await page.evaluate(() => {
  [...document.querySelectorAll('button')].filter((b) => /20\d\d/.test(b.textContent) && b.textContent.includes('R$'))[0].click();
});
await page.waitForTimeout(600);
check('clicar no histórico leva à aba "o mês"', (await titulo()).includes('agosto'));
await abrirMesUI();
e = await ler(token);
check('agosto virou o mês atual', chave(e.dados) === '7/2026');
check('histórico esvaziou', e.historico.length === 0);
check('setembro virou mês planejado', e.futuro.length === 1 && chave(e.futuro[0]) === '8/2026');
check('nada foi perdido (830 no atual)', soma(e.dados) === 830);
check('sem duplicatas', dups(e).length === 0);

console.log('\n########## 6. MÊS PLANEJADO: ver, editar, e projeção ##########');
await seta('→');
check('seta → chega no mês planejado', (await titulo()).includes('setembro'));
check('mostra aviso de planejado', (await page.locator('body').innerText()).includes('Mês futuro planejado'));
await lancar('Presente', 100);
e = await ler(token);
check('item entrou só no planejado', soma(e.futuro[0]) === 900, `(deu ${soma(e.futuro[0])})`);
check('mês atual intacto', soma(e.dados) === 830);
await seta('←');
check('voltou pro mês atual', (await titulo()).includes('agosto'));

console.log('\n########## 7. FECHAR MÊS ADOTANDO O PLANEJADO ##########');
await fecharMesUI();
e = await ler(token);
check('mês atual virou setembro (o planejado)', chave(e.dados) === '8/2026');
check('adotou os lançamentos planejados (900)', soma(e.dados) === 900, `(deu ${soma(e.dados)})`);
check('futuro esvaziou', e.futuro.length === 0);
check('agosto voltou ao histórico', e.historico.length === 1 && chave(e.historico[0]) === '7/2026');
check('sem duplicatas', dups(e).length === 0);

console.log('\n########## 8. PLANEJAMENTO VAZIO SE LIMPA SOZINHO ##########');
// (o registro vazio era o que zerava a projecao e, no fechamento, apagava
//  os fixos. Nao deve mais nem sobreviver ao carregamento.)
await criarMesVazio(9, 2026);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('text=/Lançar conta/i', { timeout: 20000 });
await page.waitForTimeout(1500);
e = await ler(token);
check('o planejamento vazio sumiu sozinho', e.futuro.length === 0, `(sobrou ${e.futuro.length})`);
p = await projecao();
console.log('     ', p.map((x) => `${x.mes}=${x.valor}`).join('  '));
check('nenhum mês zerado na projeção', !p.some((x) => x.valor === 0));

console.log('\n########## 8b. FECHAR MÊS NUNCA APAGA OS FIXOS ##########');
{
  const antes = await ler(token);
  const fixosAntes = antes.dados.itens.filter((i) => i.tipo === 'fixo').length;
  // planta o vazio direto e fecha sem recarregar, pro caso de um registro
  // vazio aparecer durante a sessao
  await fetch(`${SB}/rest/v1/cadernos?user_id=eq.${uid}`, {
    method: 'PATCH',
    headers: { apikey: SBKEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ futuro: [{ mesBase: 9, anoBase: 2026, itens: [] }] }),
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForSelector('text=/Lançar conta/i', { timeout: 20000 });
  await fecharMesUI();
  const depois = await ler(token);
  console.log(`      ${chave(antes.dados)}(${fixosAntes} fixos) -> ${chave(depois.dados)}(${depois.dados.itens.length} itens)`);
  check('os fixos NAO sumiram ao fechar', depois.dados.itens.filter((i) => i.tipo === 'fixo').length === fixosAntes,
    `(tinha ${fixosAntes}, ficou ${depois.dados.itens.filter((i) => i.tipo === 'fixo').length})`);
  check('o mês novo não ficou vazio', soma(depois.dados) > 0, `(deu ${soma(depois.dados)})`);
  check('sem duplicatas', dups(depois).length === 0);
}

console.log('\n########## 9. DESCARTAR UM PLANEJAMENTO (com lançamentos) ##########');
e = await ler(token);
const proximoMes = (e.dados.mesBase + 1) % 12;
await criarMesComItem(proximoMes, 2026, { nome: 'Tenis', valor: 300, tipo: 'fixo' });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('text=/Lançar conta/i', { timeout: 20000 });
await seta('→');
check('está no mês planejado', (await page.locator('body').innerText()).includes('Mês futuro planejado'));
await page.getByRole('button', { name: 'Descartar este planejamento' }).click();
await page.waitForTimeout(400);
check('modal de descarte aparece', (await page.locator('body').innerText()).toLowerCase().includes('descartar'));
await page.getByRole('button', { name: 'Descartar', exact: true }).click();
await page.waitForTimeout(1500);
e = await ler(token);
check('planejamento foi descartado', e.futuro.length === 0);
p = await projecao();
console.log('     ', p.map((x) => `${x.mes}=${x.valor}`).join('  '));
check('projeção segue calculando normal', !p.some((x) => x.valor === 0));

console.log('\n########## 10. APAGAR MÊS DO HISTÓRICO ##########');
await irPara('histórico');
const estadoAntesApagar = await ler(token);
const antesHist = estadoAntesApagar.historico.length;
await page.getByRole('button', { name: /^Apagar / }).first().click();
await page.waitForTimeout(400);
check('modal de apagar aparece', (await page.locator('body').innerText()).toLowerCase().includes('apagar'));
await page.getByRole('button', { name: 'Apagar', exact: true }).click();
await page.waitForTimeout(1500);
e = await ler(token);
check('mês saiu do histórico', e.historico.length === antesHist - 1);
check('mês atual não mudou', chave(e.dados) === chave(estadoAntesApagar.dados),
  `(era ${chave(estadoAntesApagar.dados)}, ficou ${chave(e.dados)})`);
check('lançamentos do mês atual intactos', soma(e.dados) === soma(estadoAntesApagar.dados));

console.log('\n########## 11. BACKUP: exportar e restaurar ##########');
await lancar('Internet', 90);
const estadoAntes = await ler(token);
await irPara('projeção');
const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Baixar JSON' }).click()]);
const arq = "e2e/telas/wf-backup.json";
await dl.saveAs(arq);
const bk = JSON.parse(fs.readFileSync(arq, 'utf8'));
check('backup tem dados+historico+futuro', !!bk.dados && Array.isArray(bk.historico) && Array.isArray(bk.futuro));
await irPara('o mês');
await fecharMesUI();
await fecharMesUI();
check('estado mudou antes de restaurar', chave((await ler(token)).dados) !== chave(estadoAntes.dados));
await irPara('projeção');
await page.locator('input[type="file"]').setInputFiles(arq);
await page.waitForTimeout(1800);
e = await ler(token);
check('restaurou o mês atual exato', chave(e.dados) === chave(estadoAntes.dados) && soma(e.dados) === soma(estadoAntes.dados));
check('restaurou o histórico exato', e.historico.length === estadoAntes.historico.length);
check('sem duplicatas depois de restaurar', dups(e).length === 0, JSON.stringify(dups(e)));

console.log('\n########## 12. PERSISTÊNCIA (reload) ##########');
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('text=/Lançar conta/i', { timeout: 20000 });
const depoisReload = await ler(token);
check('estado igual após recarregar', JSON.stringify(depoisReload) === JSON.stringify(e));
check('tela mostra o mês certo', (await titulo()).toLowerCase().includes(['jan','fev','mar','abr','mai','jun','jul','agosto','setembro','outubro','novembro','dezembro'][depoisReload.dados.mesBase] || ''));

await page.screenshot({ path: `e2e/telas/250-workflow-final.png` });

console.log('\n==================================================');
console.log(`RESULTADO: ${passou} passaram, ${falhou} falharam`);
console.log('erros de console/página:', erros.length ? JSON.stringify(erros, null, 2) : 'nenhum');
console.log('==================================================');
await browser.close();
process.exit(falhou > 0 ? 1 : 0);
