// Página Início: conectar, testar ao vivo e copiar dados para o suporte.
import { HB1, knownPorts } from './hb1.js';
import { $, errorMessage, formatDateBR, noiseLabel, requireApis, setMeter, showAlert } from './ui.js';

const hb = new HB1();
const els = {
  status: $('#status'),
  statusText: $('#status-text'),
  connect: $('#btn-connect'),
  connected: $('#connected-actions'),
  disconnect: $('#btn-disconnect'),
  empty: $('#panel-empty'),
  live: $('#panel-live'),
  pct: $('#live-pct'),
  meter: $('#live-meter'),
  meterFill: $('#live-meter-fill'),
  alert: $('#home-alert'),
  copy: $('#btn-copy'),
  copyLabel: $('#copy-label'),
  uncal: $('#uncal-notice'),
  f: {
    serial: $('#f-serial'), uid: $('#f-uid'), fw: $('#f-fw'), mfg: $('#f-mfg'),
    noise: $('#f-noise'), raw: $('#f-raw'), range: $('#f-range'),
  },
};

let info = null;
let lastSample = null;

function render(connected) {
  els.status.classList.toggle('chip--ok', connected);
  els.statusText.textContent = connected ? 'Conectado' : 'Desconectado';
  els.connect.hidden = connected;
  els.connected.hidden = !connected;
  els.empty.hidden = connected;
  els.live.hidden = !connected;
}

function renderInfo() {
  els.f.serial.textContent = info.serial || 'Sem número';
  els.f.uid.textContent = info.uid;
  els.f.fw.textContent = info.fw;
  els.f.mfg.textContent = formatDateBR(info.mfg);
  els.f.range.textContent = info.cal ? `${info.min} – ${info.max}` : 'Não calibrado';
  els.uncal.hidden = !!info.cal;
}

hb.addEventListener('sample', (e) => {
  const s = e.detail;
  lastSample = s;
  const pct = Math.round(s.pct);
  els.pct.textContent = pct;
  els.meter.setAttribute('aria-valuenow', pct);
  setMeter(els.meterFill, s.pct / 100);
  els.f.raw.textContent = s.raw;
  const n = noiseLabel(s.noise);
  els.f.noise.textContent = n.text;
  els.f.noise.classList.toggle('ok', n.ok);
});

hb.addEventListener('disconnect', () => {
  render(false);
  info = null;
});

async function start(ask) {
  showAlert(els.alert, null);
  try {
    await hb.connect({ ask });
    info = await hb.info();
    renderInfo();
    render(true);
    await hb.stream(true);
  } catch (err) {
    if (err.code === 'cancelled' || (!ask && err.code === 'no_device')) return;
    showAlert(els.alert, errorMessage(err));
    await hb.close();
    render(false);
  }
}

els.connect.addEventListener('click', () => start(true));
els.disconnect.addEventListener('click', async () => {
  await hb.close();
  render(false);
});

els.copy.addEventListener('click', async () => {
  if (!info) return;
  const text = [
    'Handbrake HB-1',
    `Série: ${info.serial || '—'}`,
    `ID da placa: ${info.uid}`,
    `Firmware: ${info.fw}`,
    `Fabricado em: ${formatDateBR(info.mfg)}`,
    `Calibração: ${info.cal ? `${info.min}–${info.max}` : 'não calibrado'}`,
    lastSample ? `Leitura: ${lastSample.raw} (${lastSample.pct}%) · ruído ±${lastSample.noise}` : '',
    `Navegador: ${navigator.userAgent}`,
  ].filter(Boolean).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    els.copyLabel.textContent = 'Copiado';
  } catch {
    els.copyLabel.textContent = 'Não foi possível copiar';
  }
  setTimeout(() => { els.copyLabel.textContent = 'Copiar dados para o suporte'; }, 2400);
});

window.addEventListener('pagehide', () => { hb.close(); });

if (requireApis(['serial'], $('#browser-banner'))) {
  // Reconecta sozinho se o freio já foi autorizado neste navegador.
  knownPorts().then((ports) => { if (ports.length) start(false); });
  navigator.serial.addEventListener('connect', () => { if (!hb.connected) start(false); });
} else {
  els.connect.disabled = true;
}
render(false);
