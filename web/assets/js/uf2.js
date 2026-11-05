// Leitura de arquivos UF2 (formato do bootloader do RP2040).
// https://github.com/microsoft/uf2

const MAGIC_START0 = 0x0a324655;
const MAGIC_START1 = 0x9e5d5157;
const MAGIC_END = 0x0ab16f30;
const FLAG_NOT_MAIN_FLASH = 0x00000001;
const FLAG_FAMILY_ID = 0x00002000;
export const RP2040_FAMILY_ID = 0xe48bff56;

export const FLASH_BASE = 0x10000000;
export const SECTOR_SIZE = 4096;
export const PAGE_SIZE = 256;

/**
 * Converte um UF2 em setores de 4 KB prontos para gravar.
 * @param {ArrayBuffer} buffer
 * @returns {{ sectors: {addr:number, data:Uint8Array}[], bytes:number }}
 */
export function parseUF2(buffer) {
  if (buffer.byteLength % 512 !== 0 || buffer.byteLength === 0) throw new Error('UF2 inválido: tamanho');
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const pages = new Map();

  for (let off = 0; off < buffer.byteLength; off += 512) {
    const m0 = view.getUint32(off, true);
    const m1 = view.getUint32(off + 4, true);
    const mEnd = view.getUint32(off + 508, true);
    if (m0 !== MAGIC_START0 || m1 !== MAGIC_START1 || mEnd !== MAGIC_END) throw new Error(`UF2 inválido: bloco ${off / 512}`);
    const flags = view.getUint32(off + 8, true);
    const addr = view.getUint32(off + 12, true);
    const size = view.getUint32(off + 16, true);
    const family = view.getUint32(off + 28, true);
    if (flags & FLAG_NOT_MAIN_FLASH) continue;
    if ((flags & FLAG_FAMILY_ID) && family !== RP2040_FAMILY_ID) throw new Error('UF2 não é para RP2040');
    if (size !== PAGE_SIZE || addr % PAGE_SIZE !== 0) throw new Error('UF2 com bloco fora do padrão');
    if (addr < FLASH_BASE || addr >= FLASH_BASE + 16 * 1024 * 1024) throw new Error('UF2 fora da flash');
    pages.set(addr, bytes.slice(off + 32, off + 32 + size));
  }
  if (pages.size === 0) throw new Error('UF2 vazio');

  const sectors = new Map();
  for (const [addr, data] of pages) {
    const sAddr = addr - (addr % SECTOR_SIZE);
    let s = sectors.get(sAddr);
    if (!s) {
      s = new Uint8Array(SECTOR_SIZE).fill(0xff);
      sectors.set(sAddr, s);
    }
    s.set(data, addr - sAddr);
  }

  const list = [...sectors.entries()].sort((a, b) => a[0] - b[0]).map(([addr, data]) => ({ addr, data }));
  return { sectors: list, bytes: pages.size * PAGE_SIZE };
}
