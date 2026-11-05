// Gera as imagens de docs/img/ a partir do site real, com o HB-1 simulado (tools/fake-hb1.js).
// Uso: node tools/screenshots.mjs   (precisa de Playwright + Chromium)
// Rode de novo sempre que mudar o visual de alguma tela e faça commit das imagens.
import { createServer } from 'node:http';
import { mkdir, readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = fileURLToPath(new URL('..', import.meta.url));
const web = join(root, 'web');
const out = join(root, 'docs', 'img');
await mkdir(out, { recursive: true });

const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
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

const fake = await readFile(join(root, 'tools/fake-hb1.js'), 'utf8');
// Freio já calibrado e registrado, como sai da produção.
const calibrated = `Object.assign(window.__hb1, { raw: 612, min: 612, max: 3480, cal: true, serial: 'LB-HB1-000124', mfg: '2026-11-05' });
window.__hb1.saved = { min: 612, max: 3480, cal: true, serial: 'LB-HB1-000124', mfg: '2026-11-05' };`;

const browser = await chromium.launch();
async function open(path, { width = 1280, height = 860, preset = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: 'reduce' });
  await ctx.addInitScript(fake);
  if (preset) await ctx.addInitScript(calibrated);
  const page = await ctx.newPage();
  await page.goto(base + path);
  return { page, ctx };
}
const lever = (page, raw) => page.evaluate((v) => { window.__hb1.raw = v; }, raw);
const shot = (page, name, fullPage = false) => page.screenshot({ path: join(out, `${name}.png`), fullPage });
const settle = (page) => page.waitForTimeout(500);

// Início
{
  const { page, ctx } = await open('/');
  await settle(page);
  await shot(page, 'inicio-desconectado');
  await page.click('#btn-connect');
  await lever(page, 2330);
  await settle(page);
  await shot(page, 'inicio-conectado');
  await ctx.close();
}
{
  const { page, ctx } = await open('/', { width: 390, height: 844 });
  await page.click('#btn-connect');
  await lever(page, 2330);
  await settle(page);
  await shot(page, 'inicio-celular', true);
  await ctx.close();
}

// Recalibrar
{
  const { page, ctx } = await open('/recalibrar/');
  await page.click('#btn-connect');
  await page.waitForSelector('[data-step="rest"]:not([hidden])');
  await lever(page, 605);
  await page.click('#btn-rest');
  await page.waitForSelector('[data-step="pull"]:not([hidden])');
  await lever(page, 900);
  await page.click('#btn-pull');
  await page.waitForSelector('#alert-pull:not([hidden])');
  await settle(page);
  await shot(page, 'recalibrar-erro-curso');
  await lever(page, 3490);
  await page.click('#btn-pull');
  await page.waitForSelector('[data-step="review"]:not([hidden])');
  await lever(page, 2050);
  await settle(page);
  await shot(page, 'recalibrar-teste');
  await page.click('#btn-save');
  await page.waitForSelector('[data-step="done"]:not([hidden])');
  await settle(page);
  await shot(page, 'recalibrar-salvo');
  await ctx.close();
}

// Produção (a gravação USB não é simulada; usa "Só calibrar e registrar")
{
  const { page, ctx } = await open('/admin/', { preset: false });
  await page.evaluate(() => {
    localStorage.setItem('hb1.admin.nextSerial', '124');
    localStorage.setItem('hb1.admin.log', JSON.stringify([
      { serial: 'LB-HB1-000123', uid: 'E6614C2A9B0D7713', min: 598, max: 3511, fw: '1.0.0', mfg: '2026-11-05', time: '14:07' },
    ]));
  });
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#fw-chip').textContent.includes('hb1-'));
  await shot(page, 'producao-conectar');
  await page.click('#btn-connect-hb1');
  await page.waitForSelector('[data-step="cal"]:not([hidden])');
  await lever(page, 608);
  await page.click('#btn-cap-min');
  await page.waitForFunction(() => document.querySelector('#cap-min').textContent === '608');
  await lever(page, 3475);
  await page.click('#btn-cap-max');
  await page.waitForFunction(() => document.querySelector('#cap-max').textContent === '3475');
  await lever(page, 1900);
  await settle(page);
  await shot(page, 'producao-calibrar');
  await page.click('#btn-to-register');
  await settle(page);
  await shot(page, 'producao-registrar');
  await page.click('#btn-register');
  await page.waitForSelector('[data-step="done"]:not([hidden])');
  await settle(page);
  await shot(page, 'producao-pronta');
  await ctx.close();
}

// Guia de produção
{
  const { page, ctx } = await open('/admin/guia/', { preset: false });
  await settle(page);
  await shot(page, 'producao-guia', true);
  await ctx.close();
}

await browser.close();
server.close();
console.log(`Imagens em ${out}`);
