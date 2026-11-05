// Teste de ponta a ponta com HB-1 simulado (sem hardware).
// Uso: node tools/e2e.mjs   (precisa de Playwright + Chromium instalados)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = fileURLToPath(new URL('..', import.meta.url));
const web = join(root, 'web');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.uf2': 'application/octet-stream' };

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = normalize(join(web, p));
  if (!file.startsWith(web)) { res.writeHead(403).end(); return; }
  let body;
  try { body = await readFile(file); } catch { res.writeHead(404).end(); return; }
  res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' }).end(body);
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const browser = await chromium.launch();
const fake = await readFile(join(root, 'tools/fake-hb1.js'), 'utf8');
let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`); if (!ok) failures++; };

async function page(path) {
  const ctx = await browser.newContext({ reducedMotion: 'reduce' });
  await ctx.addInitScript(fake);
  const pg = await ctx.newPage();
  const errors = [];
  pg.on('pageerror', (e) => errors.push(e.message));
  pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await pg.goto(base + path);
  return { pg, errors, ctx };
}

// ---------- Início
{
  const { pg, errors, ctx } = await page('/');
  await pg.click('#btn-connect');
  await pg.waitForSelector('#panel-live:not([hidden])');
  await pg.evaluate(() => { window.__hb1.raw = 2000; });
  await pg.waitForFunction(() => document.querySelector('#f-raw').textContent === '2000');
  check(await pg.textContent('#f-uid') === 'E6614C311B4F2A35', 'Início mostra o ID da placa');
  check(await pg.isVisible('#uncal-notice'), 'Início avisa que não está calibrado');
  check(errors.length === 0, `Início sem erros de JS ${errors.join(' | ')}`);
  await ctx.close();
}

// ---------- Recalibrar
{
  const { pg, errors, ctx } = await page('/recalibrar/');
  await pg.click('#btn-connect');
  await pg.waitForSelector('[data-step="rest"]:not([hidden])');
  await pg.evaluate(() => { window.__hb1.raw = 610; });
  await pg.click('#btn-rest');
  await pg.waitForSelector('[data-step="pull"]:not([hidden])');
  await pg.evaluate(() => { window.__hb1.raw = 800; });
  await pg.click('#btn-pull');
  await pg.waitForSelector('#alert-pull:not([hidden])');
  check(await pg.$eval('#card-pull', (e) => e.classList.contains('has-error')), 'Recalibrar recusa curso curto');
  await pg.evaluate(() => { window.__hb1.raw = 3500; });
  await pg.click('#btn-pull');
  await pg.waitForSelector('[data-step="review"]:not([hidden])');
  await pg.evaluate(() => { window.__hb1.raw = 3500; });
  await pg.waitForFunction(() => document.querySelector('#review-pct').textContent === '100');
  await pg.evaluate(() => { window.__hb1.raw = 610; });
  await pg.waitForFunction(() => document.querySelector('#review-pct').textContent === '0');
  check(true, 'Recalibrar mostra 0% solto e 100% puxado');
  await pg.click('#btn-save');
  await pg.waitForSelector('[data-step="done"]:not([hidden])');
  const saved = await pg.evaluate(() => window.__hb1.saved);
  check(saved.cal && saved.min === 610 && saved.max === 3500, 'Recalibrar salva 610–3500 no freio');
  check(errors.length === 0, `Recalibrar sem erros de JS ${errors.join(' | ')}`);
  await ctx.close();
}

// ---------- Produção (só calibrar e registrar; a gravação USB precisa de hardware)
{
  const { pg, errors, ctx } = await page('/admin/');
  await pg.waitForFunction(() => document.querySelector('#fw-chip').textContent.includes('hb1-'));
  check(true, 'Produção carrega o firmware do manifest e confere o sha256');
  await pg.fill('#next-serial', '124');
  await pg.dispatchEvent('#next-serial', 'change');
  await pg.click('#btn-connect-hb1');
  await pg.waitForSelector('[data-step="cal"]:not([hidden])');
  await pg.evaluate(() => { window.__hb1.raw = 600; });
  await pg.click('#btn-cap-min');
  await pg.waitForFunction(() => document.querySelector('#cap-min').textContent === '600');
  await pg.evaluate(() => { window.__hb1.raw = 3400; });
  await pg.click('#btn-cap-max');
  await pg.waitForSelector('#btn-to-register:not([disabled])');
  await pg.click('#btn-to-register');
  check(await pg.textContent('#reg-serial') === 'LB-HB1-000124', 'Produção usa o próximo número de série');
  await pg.click('#btn-register');
  await pg.waitForSelector('[data-step="done"]:not([hidden])');
  const s = await pg.evaluate(() => window.__hb1.saved);
  check(s.serial === 'LB-HB1-000124' && /^\d{4}-\d{2}-\d{2}$/.test(s.mfg), 'Produção grava série e data na placa');
  check((await pg.$$('#log tr')).length === 1, 'Produção registra a unidade na lista');
  check(await pg.inputValue('#next-serial') === '125', 'Produção avança o contador');
  check(errors.length === 0, `Produção sem erros de JS ${errors.join(' | ')}`);
  await ctx.close();
}

// ---------- Celular: sem rolagem horizontal
{
  const ctx = await browser.newContext({ viewport: { width: 375, height: 800 } });
  const pg = await ctx.newPage();
  for (const p of ['/', '/recalibrar/', '/admin/', '/admin/guia/']) {
    await pg.goto(base + p);
    const over = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check(over <= 0, `${p} cabe em 375 px de largura`);
  }
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures ? `\n${failures} falha(s)` : '\nTudo certo');
process.exit(failures ? 1 : 0);
