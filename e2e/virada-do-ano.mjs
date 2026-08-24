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

// janeiro de 2027 como mes atual, nada mais
await page.getByRole('button', { name: 'projeção', exact: true }).click();
await page.waitForTimeout(300);
await page.locator('input[type="file"]').setInputFiles({
  name: 'c.json', mimeType: 'application/json',
  buffer: Buffer.from(JSON.stringify({
    versao: 2,
    dados: { mesBase: 0, anoBase: 2027, itens: [{ nome: 'Luz', valor: 120, tipo: 'fixo' }] },
    historico: [], futuro: [],
  })),
});
await page.waitForTimeout(2500);
await page.getByRole('button', { name: 'o mês', exact: true }).click();
await page.waitForTimeout(600);

const titulo = () => page.locator('h1').first().innerText();
check('comeca em janeiro 2027', (await titulo()).toLowerCase().includes('janeiro'));

const esperado = [
  ['dezembro', '2026'], ['novembro', '2026'], ['outubro', '2026'],
  ['setembro', '2026'], ['agosto', '2026'],
];
for (const [nome, ano] of esperado) {
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await page.waitForTimeout(350);
  const t = (await titulo()).toLowerCase();
  check(`voltou para ${nome} de ${ano}`, t.includes(nome) && t.includes(ano));
}
check('nenhum "undefined" no titulo', !(await titulo()).toLowerCase().includes('undefined'));

// lanca no dezembro do ano anterior e confere que fica no lugar certo
for (let i = 0; i < 4; i++) {
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await page.waitForTimeout(350);
}
check('voltou pra dezembro 2026', (await titulo()).toLowerCase().includes('dezembro'));
await page.getByRole('button', { name: /lançar conta/i }).click();
await page.waitForTimeout(400);
await page.locator('#nome').fill('Presente');
await page.locator('#valor').fill('200');
await page.getByRole('button', { name: 'Salvar' }).click();
await page.waitForTimeout(2500);
check('continua em dezembro 2026 depois de lancar', (await titulo()).toLowerCase().includes('dezembro'));
check('o Presente apareceu', (await page.locator('body').innerText()).includes('Presente'));

await page.getByRole('button', { name: 'Próximo mês' }).click();
await page.waitForTimeout(400);
check('e janeiro 2027 continua logo a frente', (await titulo()).toLowerCase().includes('janeiro'));
check('a Luz de janeiro segue intacta', (await page.locator('body').innerText()).includes('Luz'));

console.log('\nerros de console:', erros.length ? erros : 'nenhum');
console.log(falhas === 0 ? '\nTUDO PASSOU' : `\n${falhas} FALHA(S)`);
await browser.close();
process.exit(falhas ? 1 : 0);
