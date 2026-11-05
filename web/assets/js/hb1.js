// Conexão com o HB-1 pela Web Serial API.
// Protocolo: comandos em texto (uma linha), respostas em JSON (uma linha).
// Ver docs/protocolo-serial.md.

// Precisa casar com HB1_USB_VID / HB1_USB_PID em firmware/src/config.h.
export const HB1_USB_FILTER = { usbVendorId: 0x2e8a, usbProductId: 0x10c8 };

export class HB1Error extends Error {
  constructor(code, detail) {
    super(detail || code);
    this.code = code;
  }
}

export const supportsSerial = () => typeof navigator !== 'undefined' && 'serial' in navigator;

const isHB1 = (port) => {
  const info = port.getInfo();
  return info.usbVendorId === HB1_USB_FILTER.usbVendorId && info.usbProductId === HB1_USB_FILTER.usbProductId;
};

/** Portas HB-1 que o usuário já autorizou neste site (não precisa de clique). */
export async function knownPorts() {
  if (!supportsSerial()) return [];
  return (await navigator.serial.getPorts()).filter(isHB1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Eventos:
 *  - "sample"     detail: { raw, pct, noise }
 *  - "disconnect"
 */
export class HB1 extends EventTarget {
  constructor() {
    super();
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.pending = [];
    this.queue = Promise.resolve();
    this.encoder = new TextEncoder();
    this._onDisconnect = (e) => {
      if (e.target === this.port) this._teardown();
    };
  }

  get connected() {
    return !!this.port;
  }

  /**
   * Conecta. Se `ask` for true e não houver porta autorizada, abre o seletor
   * do navegador (precisa ser chamado a partir de um clique).
   */
  async connect({ ask = true, port = null } = {}) {
    if (!supportsSerial()) throw new HB1Error('unsupported');
    if (this.port) return this;
    let p = port;
    if (!p) [p] = await knownPorts();
    if (!p && ask) {
      try {
        p = await navigator.serial.requestPort({ filters: [HB1_USB_FILTER] });
      } catch (err) {
        if (err.name === 'NotFoundError') throw new HB1Error('cancelled');
        throw err;
      }
    }
    if (!p) throw new HB1Error('no_device');

    try {
      await p.open({ baudRate: 115200 });
    } catch (err) {
      if (err.name === 'InvalidStateError') throw new HB1Error('busy');
      throw new HB1Error('open_failed', err.message);
    }
    try {
      await p.setSignals({ dataTerminalReady: true, requestToSend: true });
    } catch { /* nem todo SO aceita; o firmware não depende disso */ }

    this.port = p;
    this.writer = p.writable.getWriter();
    navigator.serial.addEventListener('disconnect', this._onDisconnect);
    this._readLoop();
    await sleep(50);
    return this;
  }

  async close() {
    const port = this.port;
    if (!port) return;
    try { await this.command('STREAM OFF', 500); } catch { /* ignora */ }
    this._teardown();
    try { await this.reader?.cancel(); } catch { /* ignora */ }
    try { this.writer?.releaseLock(); } catch { /* ignora */ }
    try { await port.close(); } catch { /* ignora */ }
  }

  _teardown() {
    if (!this.port) return;
    navigator.serial.removeEventListener('disconnect', this._onDisconnect);
    this.port = null;
    for (const p of this.pending.splice(0)) {
      clearTimeout(p.timer);
      p.reject(new HB1Error('disconnected'));
    }
    this.dispatchEvent(new Event('disconnect'));
  }

  async _readLoop() {
    const decoder = new TextDecoder();
    let buf = '';
    const port = this.port;
    while (port.readable && this.port === port) {
      this.reader = port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (line) this._handleLine(line);
          }
        }
      } catch {
        break;
      } finally {
        try { this.reader.releaseLock(); } catch { /* ignora */ }
      }
    }
    this._teardown();
  }

  _handleLine(line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (msg.t === 's') {
      this.dispatchEvent(new CustomEvent('sample', { detail: msg }));
      return;
    }
    const p = this.pending.shift();
    if (!p) return;
    clearTimeout(p.timer);
    if (msg.t === 'err') p.reject(new HB1Error(msg.code));
    else p.resolve(msg);
  }

  /** Envia um comando e espera a resposta (em ordem, um por vez). */
  command(cmd, timeout = 2000) {
    const run = () =>
      new Promise((resolve, reject) => {
        if (!this.port) return reject(new HB1Error('disconnected'));
        const entry = { resolve, reject, timer: null };
        entry.timer = setTimeout(() => {
          const idx = this.pending.indexOf(entry);
          if (idx >= 0) this.pending.splice(idx, 1);
          reject(new HB1Error('timeout'));
        }, timeout);
        this.pending.push(entry);
        this.writer.write(this.encoder.encode(cmd + '\n')).catch((err) => {
          clearTimeout(entry.timer);
          reject(new HB1Error('write_failed', err.message));
        });
      });
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }

  info() { return this.command('INFO'); }
  stream(on) { return this.command(on ? 'STREAM ON' : 'STREAM OFF'); }
  capture(which) { return this.command(`CAL ${which === 'max' ? 'MAX' : 'MIN'}`, 3000); }
  save() { return this.command('SAVE', 3000); }
  discard() { return this.command('LOAD'); }

  /** Reinicia a placa em modo BOOT (para gravar firmware). A porta fecha em seguida. */
  async rebootToBootloader() {
    await this.command('BOOTSEL');
    this._teardown();
    try { await this.reader?.cancel(); } catch { /* ignora */ }
    try { this.writer?.releaseLock(); } catch { /* ignora */ }
  }
}
