// Utilitários de interface compartilhados pelas páginas.

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Mostra só o painel com data-step igual a `name` dentro de `root`. */
export function showStep(root, name) {
  for (const el of $$('[data-step]', root)) {
    const on = el.dataset.step === name;
    if (on && el.hidden) {
      el.hidden = false;
      el.classList.remove('rise');
      void el.offsetWidth; // reinicia a animação de entrada
      el.classList.add('rise');
    } else if (!on) {
      el.hidden = true;
    }
  }
}

/** Marca a lista de etapas (li[data-key]) como feitas / atual. */
export function markSteps(list, currentKey) {
  const items = $$('li[data-key]', list);
  const idx = items.findIndex((li) => li.dataset.key === currentKey);
  items.forEach((li, i) => {
    li.classList.toggle('is-done', idx === -1 ? true : i < idx);
    li.classList.toggle('is-current', i === idx);
    if (i === idx) li.setAttribute('aria-current', 'step');
    else li.removeAttribute('aria-current');
    const num = $('.step__num', li);
    if (num) num.textContent = li.classList.contains('is-done') ? '✓' : String(i + 1);
  });
}

/** Reinicia o efeito de tremida (Transitions.dev error-state-shake). */
export function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
}

/** Escreve um número com os dígitos entrando um a um (Transitions.dev number-pop-in). */
export function popNumber(el, value) {
  el.textContent = '';
  String(value).split('').forEach((c, i) => {
    const s = document.createElement('span');
    s.className = 't-digit';
    s.style.animationDelay = `${i * 70}ms`;
    s.textContent = c;
    el.appendChild(s);
  });
}

export function setMeter(fillEl, fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  fillEl.style.width = `${(f * 100).toFixed(1)}%`;
}

const MESSAGES = {
  unsupported: 'Este navegador não conecta em USB. Use o Chrome ou o Edge, no computador.',
  cancelled: 'Nenhum dispositivo escolhido.',
  no_device: 'Freio não encontrado. Confira o cabo e tente de novo.',
  busy: 'A porta está em uso por outro programa ou aba. Feche-o e tente de novo.',
  open_failed: 'Não foi possível abrir a conexão. Desconecte e conecte o cabo de novo.',
  disconnected: 'O freio foi desconectado.',
  timeout: 'O freio não respondeu. Desconecte e conecte o cabo de novo.',
  range: 'Curso muito curto. Puxe a alavanca até o batente e grave de novo.',
  flash: 'Não foi possível salvar na memória do freio. Tente de novo.',
  serial_locked: 'Esta placa já tem número de série.',
  serial_format: 'Número de série inválido. Use letras maiúsculas, números e hífen.',
  date_format: 'Data inválida.',
  claim_failed: 'O navegador não conseguiu acessar a placa em modo BOOT. No Windows, instale o driver WinUSB (ver docs/producao.md).',
  no_interface: 'Este dispositivo não parece ser um RP2040 em modo BOOT.',
  command_failed: 'A gravação falhou. Desconecte, entre em modo BOOT de novo e repita.',
  verify_failed: 'A verificação da gravação falhou. Repita a gravação.',
};

export function errorMessage(err) {
  if (err && err.code && MESSAGES[err.code]) return MESSAGES[err.code];
  console.error(err);
  return 'Algo não saiu como esperado. Desconecte o cabo, conecte de novo e repita.';
}

/** Mostra uma mensagem de erro em um elemento .alert (com ícone). */
export function showAlert(el, message) {
  if (!message) {
    el.hidden = true;
    return;
  }
  $('.alert__text', el).textContent = message;
  el.hidden = false;
}

/** Bloqueia a página quando o navegador não tem as APIs necessárias. */
export function requireApis(apis, banner) {
  const missing = apis.filter((a) => !(a in navigator));
  if (missing.length && banner) banner.hidden = false;
  return missing.length === 0;
}

export function today() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatDateBR(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function noiseLabel(noise) {
  if (noise <= 6) return { text: `Estável · ±${noise}`, ok: true };
  if (noise <= 15) return { text: `Oscilando · ±${noise}`, ok: false };
  return { text: `Instável · ±${noise}`, ok: false };
}
