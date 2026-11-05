// HB-1 simulado para testar o site sem hardware.
// Injete antes dos scripts da página (o teste e2e faz isso com Playwright).
// Imita o protocolo de docs/protocolo-serial.md com uma porta Web Serial falsa.
(() => {
  const VID = 0x2e8a;
  const PID = 0x10c8;
  const state = {
    raw: 620, min: 0, max: 4095, cal: false, serial: '', mfg: '', stream: false,
    saved: { min: 0, max: 4095, cal: false, serial: '', mfg: '' },
  };
  window.__hb1 = state; // o teste mexe em state.raw para "puxar a alavanca"

  const pct = () => {
    const span = state.max - state.min;
    if (!span) return 0;
    let p = ((state.raw - state.min) * 1000) / span;
    p = ((p - 20) * 1000) / 960;
    return Math.max(0, Math.min(1000, Math.round(p))) / 10;
  };

  class FakePort extends EventTarget {
    constructor() {
      super();
      this.opened = false;
    }
    getInfo() { return { usbVendorId: VID, usbProductId: PID }; }
    async open() {
      if (this.opened) throw new DOMException('aberta', 'InvalidStateError');
      this.opened = true;
      let ctrl;
      this.readable = new ReadableStream({ start: (c) => { ctrl = c; } });
      const enc = new TextEncoder();
      const out = (obj) => { try { ctrl.enqueue(enc.encode(JSON.stringify(obj) + '\n')); } catch { /* fechado */ } };
      this.timer = setInterval(() => {
        if (state.stream) out({ t: 's', raw: state.raw, pct: pct(), noise: 2 });
      }, 20);
      let buf = '';
      const dec = new TextDecoder();
      this.writable = new WritableStream({
        write: (chunk) => {
          buf += dec.decode(chunk);
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            const [v, a = '', val] = line.split(/\s+/);
            const A = a.toUpperCase();
            if (v === 'INFO') out({ t: 'info', fw: '1.0.0', uid: 'E6614C311B4F2A35', serial: state.serial, mfg: state.mfg, min: state.min, max: state.max, cal: state.cal });
            else if (v === 'STREAM') { state.stream = A === 'ON'; out({ t: 'ok' }); }
            else if (v === 'CAL') { const w = A === 'MAX' ? 'max' : 'min'; state[w] = state.raw; setTimeout(() => out({ t: 'cal', which: w, value: state.raw }), 200); }
            else if (v === 'SET' && A === 'SERIAL') { if (state.serial) out({ t: 'err', code: 'serial_locked' }); else { state.serial = val; out({ t: 'ok' }); } }
            else if (v === 'SET' && A === 'MFG') { state.mfg = val; out({ t: 'ok' }); }
            else if (v === 'SAVE') {
              if (Math.abs(state.max - state.min) < 400) out({ t: 'err', code: 'range' });
              else { state.cal = true; state.saved = { min: state.min, max: state.max, cal: true, serial: state.serial, mfg: state.mfg }; out({ t: 'ok', saved: true }); }
            } else if (v === 'LOAD') { Object.assign(state, state.saved); out({ t: 'ok' }); }
            else out({ t: 'err', code: 'unknown' });
          }
        },
      });
    }
    async setSignals() {}
    async close() {
      clearInterval(this.timer);
      state.stream = false;
      this.opened = false;
    }
  }

  const port = new FakePort();
  let granted = false;
  const serial = new EventTarget();
  serial.getPorts = async () => (granted ? [port] : []);
  serial.requestPort = async () => { granted = true; return port; };
  Object.defineProperty(navigator, 'serial', { value: serial, configurable: true });
})();
