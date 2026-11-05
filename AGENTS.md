# AGENTS.md

Guia para agentes de IA (e pessoas) que mexem neste repositório. Leia antes de alterar código.

## O produto em uma frase

Freio de mão USB para simulador (RP2040-Zero + hall 49E) que vira joystick no PC, com um site que grava o firmware na produção e deixa o cliente recalibrar pelo navegador.

## Mapa

```
firmware/src/
  config.h            versão, VID/PID, pinos, limites de calibração  ← comece aqui
  main.c              loop principal, HID, callbacks TinyUSB
  sensor.c            ADC (16x sobreamostragem + EMA), ruído
  protocol.c          comandos seriais → respostas JSON
  storage.c           configuração no último setor da flash (CRC32)
  usb_descriptors.c   composto CDC + HID, descritor do joystick
  led.c, ws2812.pio   LED de status da RP2040-Zero
web/
  index.html          Início: conectar, teste ao vivo, dados para suporte
  recalibrar/         assistente de recalibração do cliente
  admin/              produção (protegida pelo Cloudflare Access)
  assets/js/hb1.js        Web Serial + protocolo
  assets/js/picoboot.js   WebUSB + PICOBOOT (grava firmware no modo BOOT)
  assets/js/uf2.js        leitura de UF2
  assets/js/ui.js         utilidades de interface e mensagens de erro
  assets/css/lb.css       tokens e componentes LayerBros
  firmware/               .uf2 publicado + manifest.json (gerados pelo script)
tools/
  release-firmware.sh compila e publica o firmware em web/firmware/
  fake-hb1.js         HB-1 simulado (Web Serial falso) para testes
  e2e.mjs             teste de ponta a ponta com Playwright
  tests/              testes node:test
docs/                 documentação (índice em docs/README.md)
```

## Comandos

| Tarefa | Comando |
|---|---|
| Servir o site | `npm run dev` (http://localhost:8080) |
| Checar sintaxe JS | `npm run check` |
| Testes unitários | `npm test` |
| Teste de ponta a ponta | `node tools/e2e.mjs` (Playwright + Chromium) |
| Compilar e publicar firmware | `PICO_SDK_PATH=... tools/release-firmware.sh` |

Rode `npm run check`, `npm test` e `node tools/e2e.mjs` antes de terminar qualquer mudança no site. Rode o build do firmware antes de terminar qualquer mudança em `firmware/`.

## Invariantes (quebrar qualquer um destes quebra o produto)

1. **Protocolo serial sincronizado.** Comando ou campo novo/alterado em `firmware/src/protocol.c` exige a mesma mudança em `web/assets/js/hb1.js`, em `tools/fake-hb1.js` e em `docs/protocolo-serial.md`. Novos códigos de erro ganham mensagem em `web/assets/js/ui.js` (`MESSAGES`).
2. **VID/PID iguais** em `firmware/src/config.h` e `web/assets/js/hb1.js` (`HB1_USB_FILTER`) e `tools/fake-hb1.js`.
3. **Curso mínimo** `HB1_CAL_MIN_RANGE` (firmware) = `MIN_RANGE` em `recalibrar.js` e `admin.js`.
4. **Setor de configuração.** A configuração fica no último setor de 4 KB da flash de 2 MB. O firmware nunca pode crescer até lá (o teste `uf2.test.mjs` confere). Mudou o `hb1_config_t`? Incremente `STORAGE_VERSION` e trate a migração, ou todas as unidades em campo perdem a calibração.
5. **Versão do firmware** só muda em `config.h`; depois rode `tools/release-firmware.sh`, que gera o `.uf2` e o `manifest.json`. O CI falha se os dois divergirem. Registre no `CHANGELOG.md`.
6. **Série gravada não se apaga por engano.** `SET SERIAL` é recusado se já houver série; trocar exige `SET SERIAL!` (só para retrabalho, nunca no fluxo normal).
7. **Site sem build e sem dependências de runtime.** Só HTML, CSS e módulos ES. Scripts externos são proibidos pela CSP em `web/_headers`; a única origem externa é o Google Fonts.

## Interface e texto

- Idioma: **português do Brasil**. Voz LayerBros: frases curtas, "você", números reais, sem exclamação em série, sem "imperdível"/"premium", sem emoji. Botões começam com verbo, em caixa normal ("Gravar repouso", "Salvar no freio").
- **Um acento só: laranja** (`--laranja`). Botão primário laranja com texto `--on-laranja` (tinta, nunca branco), no máximo um por tela. Laranja como texto usa `--laranja-texto`.
- Controles são pílulas (`border-radius: 9999px`); cards e painéis usam `--r-xl`.
- Fonte única: Sono. Números, medidas, séries e códigos em `font-variation-settings: "MONO" 1` (classe `.mono`).
- Ícones: traço Lucide 1,75 px, inline SVG, `aria-hidden` quando decorativos.
- Movimento curto (150–500 ms) e sempre desligado em `prefers-reduced-motion`. Os efeitos vindos do pacote Transitions.dev (shake, success-check, shimmer, number-pop-in) estão em `lb.css`. Use com moderação, só onde ajuda a entender o estado.
- Acessibilidade: texto 4,5:1, foco visível, toque ≥ 44 px, `role="alert"` em erros, `aria-live` nos painéis que mudam.
- Logos em `web/assets/img/` vêm do design system LayerBros: não redesenhar nem trocar a fonte do nome.

## Firmware: cuidados

- Nada bloqueante no loop principal além de `sensor_average()` (≤ 200 ms, chama `tud_task()`).
- Gravação em flash só via `flash_safe_execute()` (`storage.c`).
- O ID único da placa é lido no boot (`usb_serial_string()`) e vira o número de série USB. O site compara esse ID entre o modo BOOT e o firmware para garantir que é a mesma placa.
- Mudanças não salvas são descartadas quando o site fecha a porta (DTR cai → `storage_load`).

## O que não fazer

- Não commitar `firmware/build/`.
- Não editar à mão `web/firmware/manifest.json` nem o `.uf2`.
- Não adicionar framework, bundler ou CDN ao site sem decisão explícita do dono.
- Não colocar e-mails, tokens ou dados de clientes no repositório.
- Não usar o `/admin` sem o Cloudflare Access configurado em produção.
