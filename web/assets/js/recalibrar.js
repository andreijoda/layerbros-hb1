// Página Recalibrar: soltar → puxar → testar → salvar.
import { HB1 } from './hb1.js';
import { $, errorMessage, markSteps, requireApis, setMeter, shake, showAlert, showStep } from './ui.js';

const MIN_RANGE = 400; // igual a HB1_CAL_MIN_RANGE no firmware

const hb = new HB1();
const root = $('#wizard');
const steps = $('#steps');
const els = {
  status: $('#status'),
  statusText: $('#status-text'),
  alertConnect: $('#alert-connect'),
  alertRest: $('#alert-rest'),
  alertPull: $('#alert-pull'),
  alertReview: $('#alert-review'),
  raws: [$('#raw-rest'), $('#raw-pull')],
  fills: [$('#fill-rest'), $('#fill-pull')],
  minMark: $('#min-mark'),
  cardPull: $('#card-pull'),
  pct: $('#review-pct'),
  reviewMeter: $('#review-meter'),
  reviewFill: $('#review-fill'),
  minVal: $('#val-min'),
  maxVal: $('#val-max'),
  doneVals: $('#done-vals'),
};

let step = 'connect';
let cal = { min: null, max: null };

function go(name) {
  step = name;
  showStep(root, name);
  markSteps(steps, name === 'done' ? '__all__' : name);
}

function setStatus(connected) {
  els.status.classList.toggle('chip--ok', connected);
  els.statusText.textContent = connected ? 'Conectado' : 'Desconectado';
}

hb.addEventListener('sample', (e) => {
  const s = e.detail;
  for (const r of els.raws) r.textContent = s.raw;
  for (const f of els.fills) setMeter(f, s.raw / 4095);
  const pct = Math.round(s.pct);
  els.pct.textContent = pct;
  els.reviewMeter.setAttribute('aria-valuenow', pct);
  setMeter(els.reviewFill, s.pct / 100);
});

hb.addEventListener('disconnect', () => {
  setStatus(false);
  if (step !== 'done') {
    go('connect');
    showAlert(els.alertConnect, 'O freio foi desconectado. Conecte de novo para continuar.');
  }
});

async function withBusy(btn, fn) {
  btn.disabled = true;
  try { await fn(); } finally { btn.disabled = false; }
}

$('#btn-connect').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  showAlert(els.alertConnect, null);
  try {
    await hb.connect({ ask: true });
    await hb.info();
    await hb.stream(true);
    setStatus(true);
    cal = { min: null, max: null };
    els.minMark.hidden = true;
    go('rest');
  } catch (err) {
    if (err.code !== 'cancelled') showAlert(els.alertConnect, errorMessage(err));
    await hb.close();
  }
}));

$('#btn-rest').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  showAlert(els.alertRest, null);
  try {
    const r = await hb.capture('min');
    cal.min = r.value;
    els.minMark.style.left = `${(r.value / 4095 * 100).toFixed(1)}%`;
    els.minMark.hidden = false;
    go('pull');
  } catch (err) {
    showAlert(els.alertRest, errorMessage(err));
  }
}));

$('#btn-pull').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  showAlert(els.alertPull, null);
  els.cardPull.classList.remove('has-error');
  try {
    const r = await hb.capture('max');
    if (Math.abs(r.value - cal.min) < MIN_RANGE) {
      els.cardPull.classList.add('has-error');
      shake(els.cardPull);
      showAlert(els.alertPull, errorMessage({ code: 'range' }));
      return;
    }
    cal.max = r.value;
    els.minVal.textContent = cal.min;
    els.maxVal.textContent = cal.max;
    go('review');
  } catch (err) {
    showAlert(els.alertPull, errorMessage(err));
  }
}));

$('#btn-save').addEventListener('click', (e) => withBusy(e.currentTarget, async () => {
  showAlert(els.alertReview, null);
  try {
    await hb.save();
    els.doneVals.textContent = `Repouso ${cal.min} · Puxado ${cal.max}`;
    go('done');
    await hb.close();
    setStatus(false);
  } catch (err) {
    showAlert(els.alertReview, errorMessage(err));
  }
}));

async function restart() {
  try { await hb.discard(); } catch { /* ignora */ }
  cal = { min: null, max: null };
  els.minMark.hidden = true;
  els.cardPull.classList.remove('has-error');
  go('rest');
}
$('#btn-redo').addEventListener('click', restart);
$('#btn-back-pull').addEventListener('click', () => go('rest'));
$('#btn-back-rest').addEventListener('click', async () => { await hb.close(); setStatus(false); go('connect'); });

window.addEventListener('pagehide', () => { hb.close(); });

if (!requireApis(['serial'], $('#browser-banner'))) $('#btn-connect').disabled = true;
go('connect');
