// Página de produção (/admin): gravar firmware, calibrar e registrar cada unidade.
// Protegida pelo Cloudflare Access (ver docs/deploy.md).
import { HB1, HB1_USB_FILTER, knownPorts } from './hb1.js';
import { Picoboot, knownBootDevices, requestBootDevice, waitForBootDevice } from './picoboot.js';
import { parseUF2 } from './uf2.js';
import {
  $, errorMessage, markSteps, popNumber, requireApis, setMeter, shake, showAlert, showStep, today,
} from './ui.js';

const MIN_RANGE = 400;
const SERIAL_PREFIX = 'LB-HB1-';
const LS_NEXT = 'hb1.admin.nextSerial';
const LS_LOG = 'hb1.admin.log';

const station = $('#station');
const bars = $('#bars');
const alertEl = $('#alert');

const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignora */ }
  },
};

let firmware = null;   // { version, file, sha256, sectors, bytes }
let boot = null;       // Picoboot
let hb = new HB1();
let unit = {};         // dados da unidade atual
let log = store.get(LS_LOG, []);

// ---------------------------------------------------------------- utilidades

const formatSerial = (n) => SERIAL_PREFIX + String(n).padStart(6, '0');
const nextNumber = () => Number(store.get(LS_NEXT, 1)) || 1;

function go(step) {
  showStep(station, step);
  markSteps(bars, step === 'done' ? '__all__' : step);
}

// Na produção mostramos também o detalhe técnico: ajuda a diagnosticar sem abrir o console.
function fail(err) {
  if (typeof err === 'string') return showAlert(alertEl, err);
  let msg = errorMessage(err);
  const detail = err && err.message && err.message !== err.code ? err.message : '';
  const name = err && err.name && !['Error', 'PicobootError', 'HB1Error'].includes(err.name) ? err.name : '';
  if (detail || name) msg += ` Detalhe técnico: ${[name, detail].filter(Boolean).join(': ')}`;
  showAlert(alertEl, msg);
}

async function busy(btn, fn) {
  btn.disabled = true;
  showAlert(alertEl, null);
  try { await fn(); } catch (err) { fail(err); } finally { btn.disabled = false; }
}

function renderSerialPreview() {
  $('#serial-preview').textContent = unit.serial || formatSerial(nextNumber());
}

function renderLog(newest = false) {
  const tbody = $('#log');
  tbody.textContent = '';
  log.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (newest && i === 0) tr.className = 'is-new';
    for (const v of [r.serial, r.uid, r.min, r.max, r.time]) {
      const td = document.createElement('td');
      td.textContent = v;
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  $('#count').textContent = `${log.length} ${log.length === 1 ? 'unidade' : 'unidades'}`;
}

// ---------------------------------------------------------------- operador e firmware

async function loadOperator() {
  // Cloudflare Access expõe a identidade de quem entrou.
  try {
    const r = await fetch('/cdn-cgi/access/get-identity', { credentials: 'include' });
    if (r.ok) {
      const id = await r.json();
      if (id.email) { $('#operator').textContent = id.email; return; }
    }
  } catch { /* fora do Cloudflare (dev local) */ }
  $('#operator').textContent = 'local (sem Cloudflare Access)';
}

async function loadFirmware() {
  try {
    const manifest = await (await fetch('/firmware/manifest.json', { cache: 'no-store' })).json();
    const latest = manifest.latest;
    const buf = await (await fetch(`/firmware/${latest.file}`, { cache: 'no-store' })).arrayBuffer();
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buf))].map((b) => b.toString(16).padStart(2, '0')).join('');
    if (latest.sha256 && hash !== latest.sha256) throw new Error('hash');
    firmware = { ...latest, ...parseUF2(buf) };
    $('#fw-chip').textContent = `Firmware ${latest.file}`;
    $('#fw-download').href = `/firmware/${latest.file}`;
    $('#fw-download').setAttribute('download', latest.file);
    $('#fw-file').textContent = `${latest.file} · ${(firmware.bytes / 1024).toFixed(0)} KB`;
  } catch {
    $('#fw-chip').textContent = 'Firmware indisponível';
    fail('Não foi possível carregar o firmware (firmware/manifest.json). Confira o deploy.');
  }
}

// ---------------------------------------------------------------- 1. conectar

async function useBootDevice(device) {
  boot = new Picoboot(device);
  await boot.open();
  unit.bootId = boot.uid;
  $('#boot-uid').textContent = unit.bootId || '—';
  $('#btn-flash').hidden = false;
  $('#btn-pick-hb1').hidden = true;
  $('#flash-label').textContent = 'Pronto para gravar';
  setMeter($('#flash-fill'), 0);
  $('#flash-pct').textContent = '0%';
  go('flash');
}

$('#btn-find-boot').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  const [known] = await knownBootDevices();
  await useBootDevice(known || (await requestBootDevice()));
}));

$('#btn-from-hb1').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  await hb.connect({ ask: true });
  await hb.rebootToBootloader();
  $('#boot-wait').hidden = false;
  const device = await waitForBootDevice(8000);
  if (device) {
    $('#boot-wait').hidden = true;
    await useBootDevice(device);
  } else {
    // Primeira vez com esta placa: o navegador precisa de um clique para autorizar.
    $('#btn-pick-boot').hidden = false;
  }
}));

$('#btn-pick-boot').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  await useBootDevice(await requestBootDevice());
  $('#boot-wait').hidden = true;
  $('#btn-pick-boot').hidden = true;
}));

// Caminho A: a placa já está com o firmware (arrastado para o RPI-RP2, ou retrabalho).
// Sempre abre o seletor, para o operador escolher a placa que está na bancada.
$('#btn-connect-hb1').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  let port;
  try {
    port = await navigator.serial.requestPort({ filters: [HB1_USB_FILTER] });
  } catch {
    return;
  }
  hb = new HB1();
  await hb.connect({ port });
  await startCalibration();
}));

// ---------------------------------------------------------------- 2. firmware

$('#btn-flash').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  if (!firmware) throw new Error('sem firmware');
  const label = $('#flash-label');
  const fill = $('#flash-fill');
  label.className = 't-shimmer';
  label.dataset.text = `Gravando ${firmware.file}…`;
  label.textContent = `Gravando ${firmware.file}…`;
  fill.classList.add('stripes');
  try {
    await boot.flash(firmware.sectors, (f, stage) => {
      const pct = Math.round(f * 100);
      setMeter(fill, f);
      $('#flash-pct').textContent = `${pct}%`;
      $('#flash-meter').setAttribute('aria-valuenow', pct);
      if (stage === 'verify' && !label.dataset.verifying) {
        label.dataset.verifying = '1';
        label.dataset.text = 'Verificando…';
        label.textContent = 'Verificando…';
      }
    });
    await boot.reboot();
    boot = null;
  } finally {
    fill.classList.remove('stripes');
    label.className = 'body-sm';
    delete label.dataset.verifying;
  }
  label.textContent = 'Gravado. Aguardando o HB-1 reiniciar…';
  $('#btn-flash').hidden = true;
  await connectAfterFlash();
}));

/**
 * O ID que o modo BOOT informa (serial USB do bootrom) tem outro formato que o do firmware
 * (ID único da flash, 16 hex). Só dá para afirmar "mesma placa" quando um contém o outro;
 * fora isso o resultado é "não confirmado", nunca "placa diferente".
 */
function sameBoard(bootId, fwId) {
  const a = (bootId || '').toUpperCase();
  const b = (fwId || '').toUpperCase();
  if (!a || !b) return false;
  return a === b || b.includes(a) || a.includes(b);
}

/** Depois de gravar, encontra a porta do HB-1 (de preferência a que confirma o mesmo ID). */
async function connectAfterFlash() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 700));
    const found = [];
    for (const port of await knownPorts()) {
      try {
        const candidate = new HB1();
        await candidate.connect({ ask: false, port });
        found.push({ hb: candidate, info: await candidate.info() });
      } catch { /* porta ainda não pronta ou em uso */ }
    }
    const pick = found.find((f) => sameBoard(unit.bootId, f.info.uid)) || (found.length === 1 ? found[0] : null);
    for (const f of found) if (f !== pick) await f.hb.close();
    if (pick) {
      hb = pick.hb;
      await startCalibration(pick.info);
      return;
    }
  }
  // Placa nova para este navegador: precisa de um clique para autorizar a porta.
  $('#flash-label').textContent = 'Gravado. Clique em Conectar HB-1 e escolha “Handbrake HB-1” (no Windows: “HB-1 Config (COM…)”).';
  $('#btn-pick-hb1').hidden = false;
}

$('#btn-pick-hb1').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  hb = new HB1();
  // Pede a porta explicitamente: getPorts() pode ter outro HB-1 já autorizado.
  let port;
  try {
    port = await navigator.serial.requestPort({ filters: [HB1_USB_FILTER] });
  } catch {
    return;
  }
  await hb.connect({ port });
  await startCalibration();
}));

// ---------------------------------------------------------------- 3. calibrar

function onSample(e) {
  const s = e.detail;
  $('#cal-raw').textContent = s.raw;
  $('#cal-noise').textContent = `±${s.noise}`;
  setMeter($('#cal-fill'), s.raw / 4095);
}

async function startCalibration(info) {
  info = info || (await hb.info());
  const uidNote = $('#uid-note');
  if (unit.bootId && !sameBoard(unit.bootId, info.uid)) {
    uidNote.textContent = 'Confira que só a placa que acabou de ser gravada está conectada: o site não consegue comparar os IDs dos dois modos.';
    uidNote.hidden = false;
  } else {
    uidNote.hidden = true;
  }
  unit.uid = info.uid;
  unit.fw = info.fw;
  unit.existingSerial = info.serial || '';
  unit.mfg = info.mfg || today();
  unit.min = null;
  unit.max = null;
  $('#cal-uid').textContent = `${info.uid} · fw ${info.fw}`;
  const outdated = $('#fw-outdated');
  if (firmware && info.fw !== firmware.version) {
    outdated.textContent = `Esta placa está com o firmware ${info.fw}. A versão atual é ${firmware.version}: grave de novo (caminho A ou B) antes de calibrar.`;
    outdated.hidden = false;
  } else {
    outdated.hidden = true;
  }
  $('#cap-min').textContent = '—';
  $('#cap-max').textContent = '—';
  $('#cap-min').style.color = $('#cap-max').style.color = 'var(--muted)';
  $('#btn-to-register').disabled = true;
  hb.addEventListener('sample', onSample);
  hb.addEventListener('disconnect', onUnitDisconnect);
  await hb.stream(true);
  go('cal');
}

function onUnitDisconnect() {
  if (!$('[data-step="done"]').hidden) return;
  fail('A placa foi desconectada. Conecte de novo e recomece esta unidade.');
  resetUnit();
}

function checkRange() {
  const grid = $('#cap-grid');
  const both = unit.min !== null && unit.max !== null;
  const bad = both && Math.abs(unit.max - unit.min) < MIN_RANGE;
  for (const b of grid.querySelectorAll('button')) b.classList.toggle('has-error', bad);
  if (bad) {
    shake(grid);
    fail('Curso menor que 400. Confira o ímã e a distância do sensor.');
  }
  $('#btn-to-register').disabled = !both || bad;
}

for (const which of ['min', 'max']) {
  $(`#btn-cap-${which}`).addEventListener('click', (e) => busy(e.currentTarget, async () => {
    const r = await hb.capture(which);
    unit[which] = r.value;
    const el = $(`#cap-${which}`);
    el.style.color = 'var(--ink)';
    popNumber(el, r.value);
    checkRange();
  }));
}

$('#btn-to-register').addEventListener('click', () => {
  unit.serial = unit.existingSerial || formatSerial(nextNumber());
  $('#reg-serial').textContent = unit.serial;
  $('#reg-uid').textContent = unit.uid;
  $('#reg-min').textContent = unit.min;
  $('#reg-max').textContent = unit.max;
  $('#reg-mfg').textContent = unit.mfg.split('-').reverse().join('/');
  $('#reg-note').textContent = unit.existingSerial
    ? 'Esta placa já tem número de série. Ele será mantido; só a calibração é atualizada.'
    : 'Série, data e calibração vão para a memória da placa. O cliente vê a série na tela Início.';
  renderSerialPreview();
  go('register');
});

// ---------------------------------------------------------------- 4. registrar

$('#btn-register').addEventListener('click', (e) => busy(e.currentTarget, async () => {
  if (!unit.existingSerial) {
    await hb.command(`SET SERIAL ${unit.serial}`);
    await hb.command(`SET MFG ${unit.mfg}`);
  }
  await hb.save();
  const info = await hb.info();
  if (info.serial !== unit.serial || !info.cal) throw new Error('A placa não confirmou a gravação. Repita.');

  if (!unit.existingSerial) store.set(LS_NEXT, nextNumber() + 1);
  $('#next-serial').value = nextNumber();
  const d = new Date();
  log.unshift({
    serial: unit.serial, uid: unit.uid, min: unit.min, max: unit.max, fw: unit.fw, mfg: unit.mfg,
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    at: d.toISOString(), operator: $('#operator').textContent,
  });
  store.set(LS_LOG, log);
  renderLog(true);

  $('#done-serial').textContent = unit.serial;
  go('done');
  hb.removeEventListener('disconnect', onUnitDisconnect);
  await hb.close();
}));

// ---------------------------------------------------------------- próxima / sessão

async function resetUnit() {
  hb.removeEventListener('sample', onSample);
  hb.removeEventListener('disconnect', onUnitDisconnect);
  await hb.close();
  if (boot) { await boot.close(); boot = null; }
  hb = new HB1();
  unit = {};
  $('#boot-wait').hidden = true;
  $('#btn-pick-boot').hidden = true;
  renderSerialPreview();
  $('#next-serial').value = nextNumber();
  go('connect');
}

$('#btn-next').addEventListener('click', () => { showAlert(alertEl, null); resetUnit(); });

$('#next-serial').addEventListener('change', (e) => {
  const n = parseInt(e.target.value, 10);
  if (n > 0) store.set(LS_NEXT, n);
  e.target.value = nextNumber();
  renderSerialPreview();
});

$('#btn-csv').addEventListener('click', () => {
  const head = ['serie', 'id_placa', 'min', 'max', 'firmware', 'fabricacao', 'data_hora', 'operador'];
  const rows = log.map((r) => [r.serial, r.uid, r.min, r.max, r.fw, r.mfg, r.at, r.operator]);
  const csv = [head, ...rows].map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `hb1-producao-${today()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

$('#btn-clear').addEventListener('click', () => {
  if (!log.length || !confirm('Limpar a lista desta sessão? As placas já gravadas não mudam.')) return;
  log = [];
  store.set(LS_LOG, log);
  renderLog();
});

// ---------------------------------------------------------------- início

window.addEventListener('pagehide', () => { hb.close(); boot?.close(); });

// Caminho A precisa só de Web Serial; caminho B precisa também de WebUSB.
if (!requireApis(['serial'], $('#browser-banner'))) {
  for (const b of station.querySelectorAll('button')) b.disabled = true;
} else if (!('usb' in navigator)) {
  for (const id of ['#btn-find-boot', '#btn-from-hb1']) $(id).disabled = true;
}
$('#next-serial').value = nextNumber();
renderSerialPreview();
renderLog();
go('connect');
loadOperator();
loadFirmware();
