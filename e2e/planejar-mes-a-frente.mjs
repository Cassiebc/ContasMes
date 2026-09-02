// Planejar um mês à frente sem fechar o mês atual.
//
// O bug: navegar até novembro e lançar ali fazia a conta cair em setembro,
// porque a zona de projeção não tinha registro próprio e `mesDaTela()` caía no
// mês atual. Consertar só isso não bastava — a linha do tempo contava meses
// planejados pra frente, então assim que novembro passasse a existir ele viraria
// o passo 1 e outubro sumiria, e "fechar mês" em setembro pularia direto pra
// novembro. Este arquivo cobre os três de uma vez.

import { chromium } from 'playwright';
import { APP, EMAIL, SENHA } from './ambiente.mjs';
import { login, ler } from './estado.mjs';

let passou = 0, falhou = 0;
const check = (l, c, extra = '') => {
  if (c) { passou++; console.log(`  OK  ${l}`); }
  else { falhou++; console.log(`  XX  ${l} ${extra}`); }
};

const { token } = await login();

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
const seta = async (d) => {
  await page.getByRole('button', { name: d === '<' ? 'Mês anterior' : 'Próximo mês' }).click();
  await page.waitForTimeout(450);
};
const restaurar = async (caderno) => {
  await irPara('projeção');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(caderno)),
  });
  await page.waitForTimeout(2600);
  await irPara('o mês');
};
const lancar = async (nome, valor) => {
  await page.getByRole('button', { name: 'Lançar conta' }).click();
  await page.waitForTimeout(250);
  await page.locator('#nome').fill(nome);
  await page.locator('#valor').fill(String(valor));
  await page.getByRole('button', { name: 'Salvar' }).click();
  await page.waitForTimeout(1600);
};

// Setembro atual, com uma fixa e uma parcelada em 2 de 10. Nada planejado.
console.log('\n--- setembro atual, nada planejado ---');
await restaurar({
  versao: 2,
  dados: {
    mesBase: 8, anoBase: 2026, itens: [
      { nome: 'Aluguel', valor: 350, tipo: 'fixo' },
      { nome: 'Notebook', valor: 300, tipo: 'parcelado', paga: 2, total: 10 },
    ],
  },
  historico: [],
  futuro: [],
});
check('comeca em setembro', (await titulo()).toLowerCase().includes('setembro'));

// ===== 1. navegar ate novembro e lancar la =====
console.log('\n--- navegar dois meses e lancar em novembro ---');
await seta('>');
check('um passo a frente e outubro', (await titulo()).toLowerCase().includes('outubro'));
await seta('>');
check('dois passos a frente e novembro', (await titulo()).toLowerCase().includes('novembro'));

let tela = await corpo();
check('novembro projeta a fixa', tela.includes('Aluguel'));
check('novembro projeta a parcela ja em 04/10', tela.includes('04/10'), `(tela: ${tela.slice(0, 200)})`);
check('a tarja diz que o mes ainda nao tem planejamento', /ainda sem planejamento/i.test(tela));

await lancar('IPVA', 800);
check('continua em novembro depois de lancar', (await titulo()).toLowerCase().includes('novembro'));

let e = await ler(token);
const setembro = e.dados;
const novembro = e.futuro.find((m) => m.mesBase === 10);
check('setembro NAO foi tocado', setembro.mesBase === 8 && setembro.itens.length === 2,
  `(setembro tem ${setembro.itens.length} itens: ${setembro.itens.map((i) => i.nome)})`);
check('setembro nao ganhou o IPVA', !setembro.itens.some((i) => i.nome === 'IPVA'));
check('setembro continua sendo o mes atual', setembro.atual === true);
check('novembro passou a existir', !!novembro);
check('novembro tem o IPVA', novembro?.itens.some((i) => i.nome === 'IPVA'));
check('novembro nasceu com a fixa junto', novembro?.itens.some((i) => i.nome === 'Aluguel'),
  `(novembro tem ${novembro?.itens.map((i) => i.nome)})`);
check('e com a parcela ja avancada pra 4 de 10',
  novembro?.itens.find((i) => i.nome === 'Notebook')?.paga === 4,
  `(veio ${novembro?.itens.find((i) => i.nome === 'Notebook')?.paga})`);
check('outubro NAO foi criado a toa', !e.futuro.some((m) => m.mesBase === 9));

// ===== 2. outubro continua alcancavel =====
// Era aqui que a correcao ingenua quebrava: novembro viraria o passo 1.
console.log('\n--- outubro, que nunca existiu, continua no meio do caminho ---');
await seta('<');
check('voltar um passo de novembro da outubro, nao setembro',
  (await titulo()).toLowerCase().includes('outubro'), `(titulo: ${await titulo()})`);
tela = await corpo();
check('outubro projeta a parcela em 03/10', tela.includes('03/10'));
check('outubro NAO herdou o IPVA de novembro', !tela.includes('IPVA'));

await seta('<');
check('mais um passo atras chega em setembro', (await titulo()).toLowerCase().includes('setembro'));

// ===== 3. fechar setembro vai pra outubro, nao pra novembro =====
console.log('\n--- fechar setembro ---');
await page.getByRole('button', { name: 'Fechar mês' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Fechar mês' }).last().click();
await page.waitForTimeout(1900);

e = await ler(token);
check('o mes atual virou OUTUBRO, nao novembro', e.dados.mesBase === 9,
  `(virou o mes ${e.dados.mesBase})`);
check('outubro nasceu com a fixa', e.dados.itens.some((i) => i.nome === 'Aluguel'));
check('e com a parcela em 3 de 10',
  e.dados.itens.find((i) => i.nome === 'Notebook')?.paga === 3);
check('outubro nao herdou o IPVA', !e.dados.itens.some((i) => i.nome === 'IPVA'));
check('novembro continua planejado e intacto',
  e.futuro.find((m) => m.mesBase === 10)?.itens.some((i) => i.nome === 'IPVA'));
check('setembro foi pro historico', e.historico.some((m) => m.mesBase === 8));

await page.screenshot({ path: 'e2e/telas/600-planejar-a-frente.png' });

console.log(`\nerros de console: ${erros.length ? erros.join(' | ') : 'nenhum'}`);
console.log(`\n${passou} passaram, ${falhou} falharam`);
await browser.close();
process.exit(falhou ? 1 : 0);
