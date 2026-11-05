// node --test tools/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { parseUF2, FLASH_BASE, SECTOR_SIZE } from '../../web/assets/js/uf2.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'web/firmware/manifest.json'), 'utf8'));
const file = readFileSync(join(root, 'web/firmware', manifest.latest.file));
const buf = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);

test('manifest aponta para o arquivo certo', () => {
  assert.equal(createHash('sha256').update(file).digest('hex'), manifest.latest.sha256);
  assert.equal(file.length, manifest.latest.size);
});

test('UF2 do firmware vira setores alinhados na flash', () => {
  const { sectors, bytes } = parseUF2(buf);
  assert.ok(sectors.length > 0);
  assert.equal(sectors[0].addr, FLASH_BASE, 'começa no início da flash (boot2)');
  for (const s of sectors) {
    assert.equal(s.addr % SECTOR_SIZE, 0);
    assert.equal(s.data.length, SECTOR_SIZE);
  }
  assert.ok(bytes <= sectors.length * SECTOR_SIZE);
});

test('firmware não encosta no setor de configuração (último da flash de 2 MB)', () => {
  const { sectors } = parseUF2(buf);
  const configSector = FLASH_BASE + 2 * 1024 * 1024 - SECTOR_SIZE;
  assert.ok(sectors.every((s) => s.addr < configSector));
});

test('rejeita arquivo que não é UF2', () => {
  assert.throws(() => parseUF2(new ArrayBuffer(512)));
  assert.throws(() => parseUF2(new ArrayBuffer(100)));
});
