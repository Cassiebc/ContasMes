import { chromium } from 'playwright';
import { APP, EMAIL, SENHA } from './ambiente.mjs';


let falhas = 0;
const check = (l, c) => { if (!c) falhas++; console.log(`${c ? 'OK   ' : 'FALHOU '}${l}`); };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
const erros = [];
page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
page.on('pageerror', e => erros.push('pageerror: ' + e.message));

await page.goto(APP, { waitUntil: 'networkidle' });
await page.locator('input[type="email"]').fill(EMAIL);
await page.locator('input[type="password"]').fill(SENHA);
await page.getByRole('button', { name: /entrar/i }).click();
await page.waitForSelector('text=/lançar conta/i', { timeout: 25000 });

// ---- monta o cenario dela: NOVEMBRO atual, historico vazio, sem futuro ----
console.log('\n--- cenario: novembro atual, sem historico nenhum ---');
const caderno = {
  versao: 2,
  dados: { mesBase: 10, anoBase: 2026, itens: [{ nome: 'Internet', valor: 90, tipo: 'fixo' }] },
  historico: [],
  futuro: [],
};
await page.getByRole('button', { name: 'projeção', exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"]').setInputFiles({
  name: 'caderno.json', mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify(caderno)),
});
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'o mês', exact: true }).click();
await page.waitForTimeout(600);

const titulo = () => page.locator('h1').first().innerText();
check('mes atual e novembro', (await titulo()).toLowerCase().includes('novembro'));
check('historico esta vazio', await page.getByRole('button', { name: 'histórico', exact: true }).click().then(async () => {
  await page.waitForTimeout(400);
  const t = (await page.locator('body').innerText()).toLowerCase();
  await page.getByRole('button', { name: 'o mês', exact: true }).click();
  await page.waitForTimeout(300);
  return !t.includes('outubro') && !t.includes('agosto');
}));

// ---- o teste de verdade: a seta pra tras funciona? ----
console.log('\n--- voltar de novembro ate agosto ---');
const voltar = page.getByRole('button', { name: 'Mês anterior' });
check('a seta de voltar NAO esta desabilitada', !(await voltar.isDisabled()));

for (const esperado of ['outubro', 'setembro', 'agosto']) {
  await voltar.click();
  await page.waitForTimeout(350);
  check(`voltou para ${esperado}`, (await titulo()).toLowerCase().includes(esperado));
}
await page.screenshot({ path: `e2e/telas/400-agosto-alcancado.png` });

const corpo = await page.locator('body').innerText();
check('agosto abre vazio, sem herdar as contas de novembro', !corpo.includes('Internet'));
check('avisa que e um mes passado sem lancamento', corpo.includes('ainda sem lançamento'));
check('da pra lancar conta nele', await page.getByRole('button', { name: /lançar conta/i }).count() === 1);
check('oferece abrir o mes', await page.getByRole('button', { name: /abrir mês/i }).count() === 1);

// ---- lancar em agosto cria a linha no banco ----
console.log('\n--- lancar em agosto ---');
await page.getByRole('button', { name: /lançar conta/i }).click();
await page.waitForTimeout(400);
await page.locator('#nome').fill('Farmácia');
await page.locator('#valor').fill('45');
await page.getByRole('button', { name: 'Salvar' }).click();
await page.waitForTimeout(2500);

check('ainda esta em agosto', (await titulo()).toLowerCase().includes('agosto'));
check('a conta apareceu', (await page.locator('body').innerText()).includes('Farmácia'));
check('novembro continua sendo o atual', await page.getByRole('button', { name: /abrir mês/i }).count() === 1);
await page.screenshot({ path: `e2e/telas/401-agosto-com-lancamento.png` });

// agora agosto virou historico de verdade
await page.getByRole('button', { name: 'histórico', exact: true }).click();
await page.waitForTimeout(600);
check('agosto entrou no historico', (await page.locator('body').innerText()).toLowerCase().includes('agosto'));
await page.getByRole('button', { name: 'o mês', exact: true }).click();
await page.waitForTimeout(400);

// ---- reabrir agosto como mes atual ----
console.log('\n--- reabrir agosto como atual ---');
await page.getByRole('button', { name: 'Mês anterior' }).click();
await page.waitForTimeout(350);
let t = (await titulo()).toLowerCase();
while (!t.includes('agosto')) {
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await page.waitForTimeout(350);
  t = (await titulo()).toLowerCase();
}
await page.getByRole('button', { name: /abrir mês/i }).click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: /abrir/i }).last().click();
await page.waitForTimeout(2500);

check('agosto virou o mes atual', (await titulo()).toLowerCase().includes('agosto'));
check('agora oferece FECHAR mes (e o atual)', await page.getByRole('button', { name: /fechar mês/i }).count() === 1);
check('a Farmacia continua la', (await page.locator('body').innerText()).includes('Farmácia'));
await page.screenshot({ path: `e2e/telas/402-agosto-e-o-atual.png` });

// novembro nao se perdeu: virou futuro
await page.getByRole('button', { name: 'Próximo mês' }).click();
await page.waitForTimeout(400);
let t2 = (await titulo()).toLowerCase();
let achouNovembro = t2.includes('novembro');
for (let i = 0; i < 4 && !achouNovembro; i++) {
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await page.waitForTimeout(400);
  t2 = (await titulo()).toLowerCase();
  achouNovembro = t2.includes('novembro');
}
check('novembro nao se perdeu, esta la na frente', achouNovembro);
check('a Internet de novembro sobreviveu', (await page.locator('body').innerText()).includes('Internet'));
await page.screenshot({ path: `e2e/telas/403-novembro-preservado.png` });

console.log('\nerros de console:', erros.length ? erros : 'nenhum');
console.log(falhas === 0 ? '\nTUDO PASSOU' : `\n${falhas} FALHA(S)`);
await browser.close();
process.exit(falhas ? 1 : 0);
