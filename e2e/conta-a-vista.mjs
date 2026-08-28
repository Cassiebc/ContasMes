// A conta à vista: a compra que acontece uma vez e não atravessa o mês.
//
// O ponto delicado é que ela NÃO é um tipo no banco — é a parcela única
// (`parcelado`, 1 de 1). Este arquivo existe pra provar que a decisão se
// sustenta ponta a ponta: que grava 1/1, que aparece só no mês em que foi
// lançada, que some ao fechar o mês, que fica guardada no mês fechado, e que
// editar não a transforma em parcelada pelas costas.

import { chromium } from 'playwright';
import { APP, EMAIL, SENHA } from './ambiente.mjs';
import { login, ler, resetar } from './estado.mjs';

let passou = 0, falhou = 0;
const check = (l, c, extra = '') => {
  if (c) { passou++; console.log(`  OK  ${l}`); }
  else { falhou++; console.log(`  XX  ${l} ${extra}`); }
};

const { token, uid } = await login();
await resetar(token, uid);   // agosto/2026 vazio como mes atual

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

await page.goto(APP, { waitUntil: 'networkidle' });
await page.locator('#email').fill(EMAIL);
await page.locator('#senha').fill(SENHA);
await page.getByRole('button', { name: 'Entrar', exact: true }).click();
await page.waitForSelector('text=/Lançar conta/i', { timeout: 20000 });

const titulo = () => page.locator('h1').first().innerText();
const corpo = () => page.locator('body').innerText();
const irPara = async (aba) => {
  await page.getByRole('button', { name: aba, exact: true }).click();
  await page.waitForTimeout(400);
};
// `modo` e o segmento do formulario: 'fixo' | 'Parcelado' | 'À vista'.
const lancar = async (nome, valor, modo = 'fixo', parcelas = null) => {
  await page.getByRole('button', { name: 'Lançar conta' }).click();
  await page.waitForTimeout(250);
  if (modo !== 'fixo') await page.getByRole('button', { name: modo }).click();
  await page.locator('#nome').fill(nome);
  await page.locator('#valor').fill(String(valor));
  if (parcelas) {
    await page.locator('#paga').fill(String(parcelas[0]));
    await page.locator('#total').fill(String(parcelas[1]));
  }
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(1400);
};
const seta = async (d) => {
  await page.getByRole('button', { name: d === '<' ? 'Mês anterior' : 'Próximo mês' }).click();
  await page.waitForTimeout(450);
};

// ===== 1. lancar as tres naturezas no mesmo mes =====
console.log('\n--- lancar fixo, parcelado e a vista em agosto ---');
await lancar('Aluguel', 350);
await lancar('Notebook', 300, 'Parcelado', [2, 10]);
await lancar('Mercado', 250, 'À vista');

let e = await ler(token);
const mercado = e.dados.itens.find((i) => i.nome === 'Mercado');
check('agosto ficou com os tres lancamentos', e.dados.itens.length === 3,
  `(tem ${e.dados.itens.length})`);
check('a conta a vista foi pro banco como parcela unica',
  mercado?.tipo === 'parcelado' && mercado?.paga === 1 && mercado?.total === 1,
  `(veio ${JSON.stringify(mercado)})`);

let tela = await corpo();
check('a tela tem a secao "a vista"', /à vista/i.test(tela));
check('o parcelado de verdade mostra a parcela', tela.includes('02/10'));
check('a conta a vista NAO mostra "01/01"', !tela.includes('01/01'));
check('o total do mes soma as tres', tela.includes('900,00'));
check('o cartao mostra o subtotal a vista', /à vista\s*R\$\s*250,00/i.test(tela));

// ===== 2. ela nao existe no mes seguinte =====
console.log('\n--- a projecao nao carrega a conta a vista pra frente ---');
const proj = await irPara('projeção').then(corpo);
check('a projecao nao menciona a compra a vista', !proj.includes('Mercado'));
check('setembro projeta so fixo + parcelado (650)', proj.includes('650,00'),
  '(esperava 350 + 300)');
await irPara('o mês');

await seta('>');
check('andou pro mes projetado', (await titulo()).toLowerCase().includes('setembro'));
tela = await corpo();
check('setembro nao tem a compra a vista', !tela.includes('Mercado'));
check('setembro tem o fixo e o parcelado', tela.includes('Aluguel') && tela.includes('Notebook'));
await seta('<');

// ===== 3. fechar o mes nao a leva junto =====
console.log('\n--- fechar agosto ---');
await page.getByRole('button', { name: 'Fechar mês' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Fechar mês' }).last().click();
await page.waitForTimeout(1800);

e = await ler(token);
const nomes = e.dados.itens.map((i) => i.nome).sort();
check('setembro virou o mes atual', e.dados.mesBase === 8);
check('a compra a vista NAO atravessou o fechamento', !nomes.includes('Mercado'),
  `(ficou ${nomes.join(', ')})`);
check('o fixo atravessou', nomes.includes('Aluguel'));
check('a parcela avancou pra 3/10',
  e.dados.itens.find((i) => i.nome === 'Notebook')?.paga === 3);

const agostoFechado = e.historico.find((m) => m.mesBase === 7);
check('agosto guardou a compra a vista no historico',
  agostoFechado?.itens.some((i) => i.nome === 'Mercado' && i.total === 1));

// ===== 4. editar nao a transforma em parcelada =====
// Sem o `abrirEdicao` do App.jsx o formulario reabriria em "Parcelado", e
// bastava salvar de novo pra virar uma parcela de verdade.
console.log('\n--- editar a compra a vista no mes fechado ---');
await seta('<');
check('voltou pro agosto fechado', (await titulo()).toLowerCase().includes('agosto'));

await page.getByRole('button', { name: 'Mercado' }).click();
await page.waitForTimeout(400);
check('o formulario reabriu no segmento "A vista"',
  (await page.getByRole('button', { name: 'À vista' }).getAttribute('aria-pressed')) === 'true');
check('e nao mostra os campos de parcela', !(await corpo()).includes('Já paguei'));

await page.locator('#valor').fill('260');
await page.getByRole('button', { name: 'Salvar' }).click();
await page.waitForTimeout(1600);

e = await ler(token);
const editado = e.historico.find((m) => m.mesBase === 7)?.itens.find((i) => i.nome === 'Mercado');
check('o valor foi salvo', editado?.valor === 260, `(veio ${editado?.valor})`);
check('continua sendo parcela unica depois de editar',
  editado?.paga === 1 && editado?.total === 1,
  `(veio ${editado?.paga}/${editado?.total})`);

await page.screenshot({ path: 'e2e/telas/500-conta-a-vista.png' });

console.log(`\nerros de console: ${erros.length ? erros.join(' | ') : 'nenhum'}`);
console.log(`\n${passou} passaram, ${falhou} falharam`);
await browser.close();
process.exit(falhou ? 1 : 0);
