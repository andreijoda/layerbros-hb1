// Gravação de firmware no RP2040 pelo navegador (WebUSB + protocolo PICOBOOT do bootrom).
// Mesmo protocolo usado pelo picotool. Ver docs/web.md e o datasheet do RP2040, seção 2.8.5.

import { SECTOR_SIZE } from './uf2.js';

export const BOOTSEL_FILTER = { vendorId: 0x2e8a, productId: 0x0003 };

const PICOBOOT_MAGIC = 0x431fd10b;
const CMD = {
  EXCLUSIVE_ACCESS: 0x01,
  REBOOT: 0x02,
  FLASH_ERASE: 0x03,
  READ: 0x84,
  WRITE: 0x05,
  EXIT_XIP: 0x06,
};
const REQ_INTERFACE_RESET = 0x41;
const REQ_GET_COMMAND_STATUS = 0x42;

export const supportsUSB = () => typeof navigator !== 'undefined' && 'usb' in navigator;

export class PicobootError extends Error {
  constructor(code, detail) {
    super(detail || code);
    this.code = code;
  }
}

/** Placas em modo BOOT que o usuário já autorizou neste site. */
export async function knownBootDevices() {
  if (!supportsUSB()) return [];
  return (await navigator.usb.getDevices()).filter(
    (d) => d.vendorId === BOOTSEL_FILTER.vendorId && d.productId === BOOTSEL_FILTER.productId,
  );
}

export async function requestBootDevice() {
  if (!supportsUSB()) throw new PicobootError('unsupported');
  try {
    return await navigator.usb.requestDevice({ filters: [BOOTSEL_FILTER] });
  } catch (err) {
    if (err.name === 'NotFoundError') throw new PicobootError('cancelled');
    throw err;
  }
}

/** Espera uma placa em modo BOOT já autorizada aparecer (após BOOTSEL). */
export function waitForBootDevice(timeoutMs = 8000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (d) => {
      if (done) return;
      done = true;
      clearInterval(poll);
      clearTimeout(timer);
      navigator.usb.removeEventListener('connect', onConnect);
      resolve(d);
    };
    const onConnect = (e) => {
      const d = e.device;
      if (d.vendorId === BOOTSEL_FILTER.vendorId && d.productId === BOOTSEL_FILTER.productId) finish(d);
    };
    navigator.usb.addEventListener('connect', onConnect);
    const poll = setInterval(async () => {
      const [d] = await knownBootDevices();
      if (d) finish(d);
    }, 500);
    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

export class Picoboot {
  /** @param {USBDevice} device */
  constructor(device) {
    this.device = device;
    this.token = 1;
    this.itf = null;
    this.epIn = null;
    this.epOut = null;
  }

  /** ID único da placa (o bootrom informa como número de série USB). */
  get uid() {
    return (this.device.serialNumber || '').toUpperCase();
  }

  async open() {
    const d = this.device;
    // Uma tentativa anterior pode ter deixado o dispositivo aberto com a interface presa.
    if (d.opened) {
      try { await d.close(); } catch { /* ignora */ }
    }
    try {
      await d.open();
      if (d.configuration === null) await d.selectConfiguration(1);
    } catch (err) {
      throw new PicobootError('open_failed', `${err.name}: ${err.message}`);
    }
    if (!d.configuration) throw new PicobootError('open_failed', 'sem configuração USB ativa');
    for (const itf of d.configuration.interfaces) {
      const alt = itf.alternates[0];
      if (alt.interfaceClass === 0xff && alt.endpoints.length === 2) {
        this.itf = itf.interfaceNumber;
        for (const ep of alt.endpoints) {
          if (ep.direction === 'in') this.epIn = ep.endpointNumber;
          else this.epOut = ep.endpointNumber;
        }
      }
    }
    if (this.itf === null) throw new PicobootError('no_interface');
    try {
      await d.claimInterface(this.itf);
    } catch (err) {
      // No Windows isto falha sem o driver WinUSB na interface PICOBOOT (ver docs/producao.md).
      throw new PicobootError('claim_failed', `${err.name}: ${err.message}`);
    }
    // O reset só limpa um comando pela metade. Numa placa recém-ligada não há nada a limpar,
    // e no Windows a requisição de controle pode ser recusada: não impede a gravação.
    try {
      await this._reset();
    } catch (err) {
      console.warn('PICOBOOT reset ignorado:', err);
    }
  }

  async close() {
    try { await this.device.releaseInterface(this.itf); } catch { /* ignora */ }
    try { await this.device.close(); } catch { /* ignora */ }
  }

  async _reset() {
    await this.device.controlTransferOut({
      requestType: 'class', recipient: 'interface', request: REQ_INTERFACE_RESET, value: 0, index: this.itf,
    });
  }

  async _status() {
    try {
      const r = await this.device.controlTransferIn({
        requestType: 'class', recipient: 'interface', request: REQ_GET_COMMAND_STATUS, value: 0, index: this.itf,
      }, 16);
      return r.data ? r.data.getUint32(4, true) : -1;
    } catch {
      return -1;
    }
  }

  /**
   * @param {number} id comando
   * @param {Uint8Array} args até 16 bytes
   * @param {{length?:number, data?:Uint8Array}} transfer
   */
  async _cmd(id, args = new Uint8Array(0), { length = 0, data = null } = {}) {
    const pkt = new ArrayBuffer(32);
    const v = new DataView(pkt);
    v.setUint32(0, PICOBOOT_MAGIC, true);
    v.setUint32(4, this.token++, true);
    v.setUint8(8, id);
    v.setUint8(9, args.length);
    v.setUint16(10, 0, true);
    v.setUint32(12, data ? data.length : length, true);
    new Uint8Array(pkt, 16, 16).set(args);

    const fail = async (where) => {
      const status = await this._status();
      await this._reset().catch(() => {});
      throw new PicobootError('command_failed', `${where} (cmd 0x${id.toString(16)}, status ${status})`);
    };

    let r = await this.device.transferOut(this.epOut, pkt);
    if (r.status !== 'ok') await fail('envio do comando');

    let result = null;
    if (id & 0x80) {
      const res = await this.device.transferIn(this.epIn, length);
      if (res.status !== 'ok') await fail('leitura');
      result = new Uint8Array(res.data.buffer, res.data.byteOffset, res.data.byteLength);
      r = await this.device.transferOut(this.epOut, new ArrayBuffer(0)); // ack
      if (r.status !== 'ok') await fail('ack');
    } else {
      if (data) {
        r = await this.device.transferOut(this.epOut, data);
        if (r.status !== 'ok') await fail('dados');
      }
      const ack = await this.device.transferIn(this.epIn, 1);
      if (ack.status !== 'ok') await fail('ack');
    }
    return result;
  }

  static _u32(...vals) {
    const b = new Uint8Array(vals.length * 4);
    const v = new DataView(b.buffer);
    vals.forEach((x, i) => v.setUint32(i * 4, x >>> 0, true));
    return b;
  }

  /**
   * Grava os setores na flash, verifica e reinicia a placa.
   * @param {{addr:number, data:Uint8Array}[]} sectors
   * @param {(fraction:number, stage:string) => void} onProgress
   */
  async flash(sectors, onProgress = () => {}) {
    await this._cmd(CMD.EXCLUSIVE_ACCESS, new Uint8Array([1]));
    await this._cmd(CMD.EXIT_XIP);

    const total = sectors.length * 2; // gravar + verificar
    let done = 0;
    for (const s of sectors) {
      await this._cmd(CMD.FLASH_ERASE, Picoboot._u32(s.addr, SECTOR_SIZE));
      await this._cmd(CMD.WRITE, Picoboot._u32(s.addr, SECTOR_SIZE), { data: s.data });
      onProgress(++done / total, 'write');
    }
    for (const s of sectors) {
      const back = await this._cmd(CMD.READ, Picoboot._u32(s.addr, SECTOR_SIZE), { length: SECTOR_SIZE });
      for (let i = 0; i < SECTOR_SIZE; i++) {
        if (back[i] !== s.data[i]) {
          throw new PicobootError('verify_failed', `diferença em 0x${(s.addr + i).toString(16)}`);
        }
      }
      onProgress(++done / total, 'verify');
    }
  }

  /** Reinicia e roda o firmware gravado. */
  async reboot(delayMs = 500) {
    try {
      await this._cmd(CMD.REBOOT, Picoboot._u32(0, 0x20042000, delayMs));
    } finally {
      await this.close();
    }
  }
}
