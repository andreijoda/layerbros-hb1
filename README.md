# LayerBros · Handbrake HB-1

Freio de mão USB para simulador. Uma **RP2040-Zero** lê um sensor hall **49E** e aparece no PC como **joystick** (um eixo e um botão). Um **site** grava o firmware na produção e permite ao cliente recalibrar o freio pelo navegador, sem instalar nada.

```
┌────────────┐  USB (HID + serial)   ┌─────────────────────────────┐
│  HB-1      │ ────────────────────▶ │ Jogo: joystick, eixo X      │
│ RP2040-Zero│                       └─────────────────────────────┘
│ + hall 49E │  Web Serial / WebUSB  ┌─────────────────────────────┐
│            │ ◀───────────────────▶ │ Site (Chrome/Edge)          │
└────────────┘                       │  /            teste ao vivo │
                                     │  /recalibrar/ cliente       │
                                     │  /admin/      produção      │
                                     └─────────────────────────────┘
```

## O que tem aqui

| Pasta | Conteúdo |
|---|---|
| [`firmware/`](firmware/) | Firmware em C (Pico SDK 2.1.1 + TinyUSB) |
| [`web/`](web/) | Site estático (HTML, CSS e JS puros, sem build), publicado no Cloudflare Pages |
| [`web/firmware/`](web/firmware/) | O `.uf2` publicado e o `manifest.json` que a produção usa |
| [`tools/`](tools/) | Script de release do firmware, HB-1 simulado e testes |
| [`docs/`](docs/) | Toda a documentação |

## Começo rápido

**Site (local):**

```bash
npm run dev
```

Abra http://localhost:8080 no Chrome. Web Serial e WebUSB funcionam em `localhost` sem HTTPS.

**Firmware:**

```bash
export PICO_SDK_PATH=~/pico-sdk
```

```bash
tools/release-firmware.sh
```

O script compila e publica `web/firmware/hb1-<versão>.uf2` com o manifest. Detalhes em [docs/firmware.md](docs/firmware.md).

**Testes:**

```bash
npm test
```

```bash
node tools/e2e.mjs
```

O segundo roda as três páginas num Chromium com um HB-1 simulado (precisa do Playwright).

## Documentação

- [Hardware e montagem](docs/hardware.md)
- [Firmware](docs/firmware.md)
- [Protocolo serial](docs/protocolo-serial.md)
- [Site](docs/web.md)
- [Produção: passo a passo do operador](docs/producao.md)
- [Deploy no Cloudflare (Pages + Access)](docs/deploy.md)
- [Pendências antes de vender](docs/pendencias.md)
- [Histórico de versões](CHANGELOG.md)

Para agentes de IA trabalhando no repositório: [AGENTS.md](AGENTS.md).
