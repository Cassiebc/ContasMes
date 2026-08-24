import { chromium, devices } from 'playwright';
import { APP, EMAIL, SENHA } from './ambiente.mjs';


let falhas = 0;
const check = (l, c) => { if (!c) falhas++; console.log(`${c ? 'OK   ' : 'FALHOU '}${l}`); };

const browser = await chromium.launch();

// O Chrome do Android dispara `beforeinstallprompt`; navegador automatizado
// nao dispara. Simula o evento na forma que o codigo consome.
const disparar = (page) => page.evaluate(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  window.__promptChamado = 0;
  e.prompt = () => { window.__promptChamado++; };
  e.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(e);
});

const abrir = async (ctx) => {
  const page = await ctx.newPage();
  const erros = [];
  page.on('console', m => { if (m.type() === 'error') erros.push(m.text()); });
  page.on('pageerror', e => erros.push('pageerror: ' + e.message));
  await page.goto(APP, { waitUntil: 'networkidle' });
  return { page, erros };
};
const entrar = async (page) => {
  await page.locator('input[type="email"]').fill(EMAIL);
  await page.locator('input[type="password"]').fill(SENHA);
  await page.getByRole('button', { name: /^entrar$/i }).click();
  await page.waitForSelector('text=/lançar conta/i', { timeout: 25000 });
};
const botaoInstalar = (p) => p.getByRole('button', { name: /Instalar na tela inicial/i });
const avisoInstalar = (p) => p.getByRole('button', { name: 'Instalar', exact: true });

// ---------- 1. tela de login (Android) ----------
console.log('\n--- tela de login, Android ---');
const ctx1 = await browser.newContext(devices['Pixel 7']);
const { page, erros } = await abrir(ctx1);
check('sem o evento, nada aparece no login', await botaoInstalar(page).count() === 0);

await disparar(page);
await page.waitForTimeout(300);
check('depois do evento, o botao aparece NO LOGIN', await botaoInstalar(page).count() === 1);
check('explica o ganho', (await page.locator('body').innerText()).includes('sem a barra do navegador'));
await page.screenshot({ path: `e2e/telas/310-login-instalar.png`, fullPage: true });

await botaoInstalar(page).click();
await page.waitForTimeout(400);
check('clicar abre o convite do sistema', await page.evaluate(() => window.__promptChamado) === 1);
check('depois de aceitar, some', await botaoInstalar(page).count() === 0);

// ---------- 2. aviso dentro do app, e o login como reserva ----------
console.log('\n--- aviso na aba "o mes", e o login como reserva ---');
const ctx2 = await browser.newContext(devices['Pixel 7']);
const r2 = await abrir(ctx2);
await entrar(r2.page);
await disparar(r2.page);
await r2.page.waitForTimeout(300);
check('o aviso aparece na aba "o mes"', await avisoInstalar(r2.page).count() === 1);
await r2.page.screenshot({ path: `e2e/telas/311-aviso-no-mes.png` });

await r2.page.getByRole('button', { name: /Dispensar aviso/i }).click();
await r2.page.waitForTimeout(200);
check('dispensar esconde o aviso', await avisoInstalar(r2.page).count() === 0);

await r2.page.getByRole('button', { name: 'projeção', exact: true }).click();
await r2.page.waitForTimeout(400);
check('projecao NAO tem mais o botao', await botaoInstalar(r2.page).count() === 0);
check('mas o backup continua la', await r2.page.getByRole('button', { name: /Baixar JSON/i }).count() === 1);

await r2.page.getByRole('button', { name: /^Sair$/i }).click();
await r2.page.waitForTimeout(1500);
await disparar(r2.page);
await r2.page.waitForTimeout(300);
check('quem dispensou reencontra no login', await botaoInstalar(r2.page).count() === 1);
await botaoInstalar(r2.page).click();
await r2.page.waitForTimeout(300);
check('o botao do login abre o convite', await r2.page.evaluate(() => window.__promptChamado) === 1);

// ---------- 3. iPhone ----------
console.log('\n--- iPhone (Safari, sem o evento) ---');
const ctx3 = await browser.newContext(devices['iPhone 13']);
const r3 = await abrir(ctx3);
await r3.page.waitForTimeout(400);
check('no iPhone o botao aparece sem evento nenhum', await botaoInstalar(r3.page).count() === 1);
await botaoInstalar(r3.page).click();
await r3.page.waitForTimeout(300);
const txt = await r3.page.locator('body').innerText();
check('ensina o caminho do Safari', txt.includes('Compartilhar') && txt.includes('Tela de Início'));
await r3.page.screenshot({ path: `e2e/telas/312-ios-login.png` });
await r3.page.getByRole('button', { name: 'Entendi' }).click();
await r3.page.waitForTimeout(200);
check('fecha a explicacao', await r3.page.getByRole('button', { name: 'Entendi' }).count() === 0);

// ---------- 4. ja instalado ----------
console.log('\n--- ja instalado (standalone) ---');
const ctx4 = await browser.newContext(devices['Pixel 7']);
const p4 = await ctx4.newPage();
await p4.addInitScript(() => {
  const orig = window.matchMedia.bind(window);
  window.matchMedia = (q) => q.includes('display-mode: standalone')
    ? { matches: true, addEventListener() {}, removeEventListener() {} } : orig(q);
});
await p4.goto(APP, { waitUntil: 'networkidle' });
await p4.evaluate(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(e);
});
await p4.waitForTimeout(300);
check('quem ja instalou nao ve nada no login', await botaoInstalar(p4).count() === 0);
await entrar(p4);
await p4.waitForTimeout(300);
check('nem o aviso na aba "o mes"', await avisoInstalar(p4).count() === 0);

const todos = [...erros, ...r2.erros, ...r3.erros];
console.log('\nerros de console:', todos.length ? todos : 'nenhum');
console.log(falhas === 0 ? '\nTUDO PASSOU' : `\n${falhas} FALHA(S)`);
await browser.close();
process.exit(falhas ? 1 : 0);
