// Lançar num mês à frente sem estragar a projeção nem duplicar no fechamento.
//
// O relato que originou este arquivo: em setembro, lançou uma conta em
// outubro; a conta que lançou depois em setembro não apareceu mais na
// projeção; e ao fechar setembro, outubro veio com tudo duplicado.
//
// Eram duas causas. Outubro planejado guardava uma CÓPIA de setembro, que
// parava no tempo. E quem decidia se o mês seguinte "era novo" era a tela, não
// o banco — um toque duplo bastava pra as contas entrarem duas vezes.
//
// Roda contra o banco de mentira (veja README): sobe o app sozinho, não pede
// conta e não toca em produção.

import { chromium } from 'playwright';
import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

let passou = 0, falhou = 0;
const check = (l, c, extra = '') => {
  if (c) { passou++; console.log(`  OK  ${l}`); }
  else { falhou++; console.log(`  XX  ${l} ${extra}`); }
};

const servidor = await createServer({
  configFile: fileURLToPath(new URL('./vite.config.js', import.meta.url)),
});
await servidor.listen();
const APP = servidor.resolvedUrls.local[0];

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });

await page.goto(APP, { waitUntil: 'networkidle' });
await page.waitForSelector('text=/Lançar conta/i', { timeout: 20000 });

const titulo = async () => (await page.locator('h1').first().innerText()).toLowerCase();
const corpo = () => page.locator('body').innerText();
const espera = (ms = 350) => page.waitForTimeout(ms);
const irPara = async (aba) => {
  await page.getByRole('button', { name: aba, exact: true }).click();
  await espera();
};
const seta = async (d) => {
  await page.getByRole('button', { name: d === '<' ? 'Mês anterior' : 'Próximo mês' }).click();
  await espera();
};
const restaurar = async (caderno) => {
  await irPara('projeção');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'c.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(caderno)),
  });
  await espera(600);
  await irPara('o mês');
};
const preencher = async (nome, valor, tipo) => {
  await page.getByRole('button', { name: 'Lançar conta' }).click();
  await espera(200);
  await page.locator('#nome').fill(nome);
  await page.locator('#valor').fill(String(valor));
  if (tipo) await page.getByRole('button', { name: tipo, exact: true }).click();
};
const lancar = async (nome, valor, tipo) => {
  await preencher(nome, valor, tipo);
  await page.getByRole('button', { name: 'Salvar' }).click();
  await espera(500);
};
// Dois toques no mesmo botão antes de a tela redesenhar — o dedo que treme.
const toqueDuplo = async (nome) => {
  const botao = page.getByRole('button', { name: nome, exact: true }).last();
  await botao.evaluate((b) => { b.click(); b.click(); });
  await espera(600);
};
const temX = (nome) => page.getByRole('button', { name: `Remover ${nome}` }).count();

// O que está gravado, direto do banco.
const banco = () => page.evaluate(() => {
  const { meses, lancamentos } = window.__banco.tabelas();
  return meses
    .map((m) => ({
      mes: m.mes, ano: m.ano, atual: m.atual, planejado: m.planejado,
      itens: lancamentos.filter((l) => l.mes_id === m.id)
        .map((l) => ({ nome: l.nome, paga: l.paga, total: l.total })),
    }))
    .sort((a, b) => a.ano - b.ano || a.mes - b.mes);
});
const mesNoBanco = async (mes) => (await banco()).find((m) => m.mes === mes);
const nomes = (m) => (m?.itens ?? []).map((i) => i.nome).sort().join(',');

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
check('comeca em setembro', (await titulo()).includes('setembro'));

// ===== 1. lancar em outubro sem sair de setembro =====
console.log('\n--- lancar uma conta em outubro ---');
await seta('>');
check('um passo a frente e outubro', (await titulo()).includes('outubro'));
let tela = await corpo();
check('outubro projeta a fixa e a parcela em 03/10', tela.includes('Aluguel') && tela.includes('03/10'));
check('a tarja diz que ainda nao ha planejamento', /ainda sem planejamento/i.test(tela));

await lancar('IPVA', 800, 'À vista');
check('continua em outubro depois de lancar', (await titulo()).includes('outubro'));
tela = await corpo();
check('a tela de outubro mostra o IPVA junto das contas de setembro',
  tela.includes('IPVA') && tela.includes('Aluguel') && tela.includes('Notebook'));
check('a tarja passa a dizer planejado', /Mês futuro planejado/i.test(tela));

let out = await mesNoBanco(9);
check('no banco, outubro guarda SO o IPVA', nomes(out) === 'IPVA', `(tem ${nomes(out)})`);
check('e esta marcado como plano', out?.planejado === true);
let set = await mesNoBanco(8);
check('setembro nao foi tocado e segue atual', nomes(set) === 'Aluguel,Notebook' && set.atual);

check('o IPVA pode ser apagado em outubro', (await temX('IPVA')) === 1);
check('o Aluguel, que vem de setembro, aparece sem o x', (await temX('Aluguel')) === 0);
check('e a tela explica por que', /vêm de um mês anterior/i.test(tela));

// ===== 2. o que entra em setembro depois continua chegando a outubro =====
console.log('\n--- lancar em setembro DEPOIS de ter planejado outubro ---');
await seta('<');
check('voltou pra setembro', (await titulo()).includes('setembro'));
await lancar('Internet', 100);
check('setembro ganhou a Internet', nomes(await mesNoBanco(8)) === 'Aluguel,Internet,Notebook');

await seta('>');
tela = await corpo();
check('outubro mostra a Internet lancada depois', tela.includes('Internet'), `(tela: ${tela.slice(0, 300)})`);
check('o total de outubro soma as quatro contas (1.550)', tela.includes('1.550,00'));
await seta('>');
tela = await corpo();
check('novembro tambem mostra a Internet', tela.includes('Internet'));
check('novembro nao herda o IPVA, que era a vista', !tela.includes('IPVA'));
check('novembro projeta a parcela em 04/10', tela.includes('04/10'));

await irPara('projeção');
tela = await corpo();
check('a projecao lista outubro com 1.550 e novembro com 750',
  tela.includes('1.550,00') && tela.includes('750,00'), `(tela: ${tela.slice(0, 300)})`);
await irPara('o mês');

// ===== 3. toque duplo no Salvar nao lanca duas vezes =====
console.log('\n--- toque duplo no salvar ---');
await preencher('Agua', 60);
await toqueDuplo('Salvar');
set = await mesNoBanco(8);
check('a conta entrou uma vez so', set.itens.filter((i) => i.nome === 'Agua').length === 1,
  `(tem ${nomes(set)})`);

// ===== 4. fechar setembro, com toque duplo =====
console.log('\n--- fechar setembro tocando duas vezes ---');
await page.getByRole('button', { name: 'Fechar mês' }).click();
await espera(250);
tela = await corpo();
check('o alerta avisa que soma ao que ja foi lancado em outubro', /junto com o que você já lançou/i.test(tela));
await toqueDuplo('Fechar mês');

check('o mes atual virou outubro', (await titulo()).includes('outubro'));
out = await mesNoBanco(9);
check('outubro tem cada conta UMA vez', nomes(out) === 'Agua,Aluguel,IPVA,Internet,Notebook',
  `(tem ${nomes(out)})`);
check('a parcela avancou pra 3 de 10', out.itens.find((i) => i.nome === 'Notebook')?.paga === 3);
check('outubro e o atual e deixou de ser plano', out.atual === true && out.planejado === false);
check('setembro foi pro historico, intacto',
  nomes(await mesNoBanco(8)) === 'Agua,Aluguel,Internet,Notebook' && !(await mesNoBanco(8)).atual);
check('nao sobrou mes a frente', (await banco()).every((m) => m.ano === 2026 && m.mes <= 9));
check('no mes atual tudo pode ser editado de novo', (await temX('Aluguel')) === 1);

// ===== 5. fixa lancada a frente segue adiante; abrir o mes traz o resto =====
console.log('\n--- fixa lancada em dezembro, e abrir dezembro ---');
await seta('>');
await seta('>');
check('dois passos a frente e dezembro', (await titulo()).includes('dezembro'));
await lancar('Academia', 90);
check('dezembro guarda so a Academia', nomes(await mesNoBanco(11)) === 'Academia');

await seta('>');
tela = await corpo();
check('janeiro herda a Academia', (await titulo()).includes('janeiro') && tela.includes('Academia'));
check('em janeiro ela aparece sem o x', (await temX('Academia')) === 0);
await seta('<');
await seta('<');
tela = await corpo();
check('novembro, que vem antes, nao tem a Academia',
  (await titulo()).includes('novembro') && !tela.includes('Academia'));
check('novembro nao foi criado a toa', !(await mesNoBanco(10)));

await seta('>');
await page.getByRole('button', { name: 'Abrir mês' }).click();
await espera(250);
await page.getByRole('button', { name: /^Abrir/ }).last().click();
await espera(600);
check('dezembro virou o mes atual', (await titulo()).includes('dezembro'));
const dez = await mesNoBanco(11);
check('e abriu com as contas todas, nao so a Academia',
  nomes(dez) === 'Academia,Agua,Aluguel,Internet,Notebook', `(tem ${nomes(dez)})`);
check('com a parcela em 5 de 10', dez.itens.find((i) => i.nome === 'Notebook')?.paga === 5);
check('o IPVA a vista ficou em outubro', nomes(await mesNoBanco(9)).includes('IPVA') && !nomes(dez).includes('IPVA'));

// ===== 6. descartar o que foi lancado a frente =====
console.log('\n--- descartar o planejamento ---');
await seta('>');
await lancar('Matricula', 500, 'À vista');
check('janeiro ficou planejado', nomes(await mesNoBanco(0)) === 'Matricula');
await page.getByRole('button', { name: 'Descartar este planejamento' }).click();
await espera(250);
await page.getByRole('button', { name: 'Descartar', exact: true }).click();
await espera(500);
check('o plano de janeiro saiu do banco', !(await mesNoBanco(0)));
check('dezembro continua inteiro', nomes(await mesNoBanco(11)) === 'Academia,Agua,Aluguel,Internet,Notebook');

await page.screenshot({ path: 'e2e/telas/700-lancar-a-frente.png' });

console.log(`\nerros de console: ${erros.length ? erros.join(' | ') : 'nenhum'}`);
console.log(`\n${passou} passaram, ${falhou} falharam`);
await browser.close();
await servidor.close();
process.exit(falhou || erros.length ? 1 : 0);
