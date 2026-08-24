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

const titulo = () => page.locator('h1').first().innerText();
const corpo = () => page.locator('body').innerText();
const restaurar = async (caderno) => {
  await page.getByRole('button', { name: 'projeção', exact: true }).click();
  await page.waitForTimeout(300);
  await page.locator('input[type="file"]').setInputFiles({
    name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(caderno)),
  });
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: 'o mês', exact: true }).click();
  await page.waitForTimeout(600);
};
const projecao = async () => {
  await page.getByRole('button', { name: 'projeção', exact: true }).click();
  await page.waitForTimeout(500);
  const t = await corpo();
  await page.getByRole('button', { name: 'o mês', exact: true }).click();
  await page.waitForTimeout(400);
  return t;
};

// ===== 1. apagar o ultimo lancamento de um mes PLANEJADO =====
// Cenario do CLAUDE.md: o mes zerava a projecao ao ficar vazio.
console.log('\n--- apagar o ultimo lancamento de um mes planejado ---');
await restaurar({
  versao: 2,
  dados: { mesBase: 7, anoBase: 2026, itens: [{ nome: 'Aluguel', valor: 350, tipo: 'fixo' }] },
  historico: [],
  futuro: [{ mesBase: 8, anoBase: 2026, itens: [{ nome: 'Extra', valor: 100, tipo: 'fixo' }] }],
});
check('comeca em agosto', (await titulo()).toLowerCase().includes('agosto'));

await page.getByRole('button', { name: 'Próximo mês' }).click();
await page.waitForTimeout(400);
check('foi pro setembro planejado', (await titulo()).toLowerCase().includes('setembro'));
check('o Extra esta la', (await corpo()).includes('Extra'));

await page.getByRole('button', { name: 'Remover Extra' }).click();
await page.waitForTimeout(2500);

const proj = await projecao();
check('setembro NAO zerou: herdou o Aluguel', /setembro[\s\S]{0,120}350,00/.test(proj));
check('sem erro na tela', !(await corpo()).includes('Não deu para salvar'));

// ===== 2. apagar o ultimo lancamento de um mes do PASSADO que eu criei =====
// Caso novo: o mes passa a nao existir mais, e a tela nao pode se perder.
console.log('\n--- apagar o ultimo lancamento de um mes do passado ---');
await restaurar({
  versao: 2,
  dados: { mesBase: 10, anoBase: 2026, itens: [{ nome: 'Internet', valor: 90, tipo: 'fixo' }] },
  historico: [],
  futuro: [],
});
check('comeca em novembro', (await titulo()).toLowerCase().includes('novembro'));

for (let i = 0; i < 3; i++) {
  await page.getByRole('button', { name: 'Mês anterior' }).click();
  await page.waitForTimeout(350);
}
check('chegou em agosto', (await titulo()).toLowerCase().includes('agosto'));

await page.getByRole('button', { name: /lançar conta/i }).click();
await page.waitForTimeout(400);
await page.locator('#nome').fill('Farmácia');
await page.locator('#valor').fill('45');
await page.getByRole('button', { name: 'Salvar' }).click();
await page.waitForTimeout(2500);
check('continua em agosto depois de lancar', (await titulo()).toLowerCase().includes('agosto'));

await page.getByRole('button', { name: 'Remover Farmácia' }).click();
await page.waitForTimeout(2500);
check('continua em agosto depois de apagar', (await titulo()).toLowerCase().includes('agosto'));
check('agosto voltou a ficar vazio', !(await corpo()).includes('Farmácia'));
check('nao herdou a Internet de novembro', !(await corpo()).includes('Internet'));
check('novembro segue sendo o atual', await page.getByRole('button', { name: /abrir mês/i }).count() === 1);

// volta pro atual e confere que nada se perdeu
for (let i = 0; i < 3; i++) {
  await page.getByRole('button', { name: 'Próximo mês' }).click();
  await page.waitForTimeout(400);
}
check('voltou pro novembro atual', (await titulo()).toLowerCase().includes('novembro'));
check('a Internet continua intacta', (await corpo()).includes('Internet'));

console.log('\nerros de console:', erros.length ? erros : 'nenhum');
console.log(falhas === 0 ? '\nTUDO PASSOU' : `\n${falhas} FALHA(S)`);
await browser.close();
process.exit(falhas ? 1 : 0);
