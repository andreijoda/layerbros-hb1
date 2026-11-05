# Histórico de versões

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versões do firmware seguem [SemVer](https://semver.org/lang/pt-BR/).

## [Não lançado]

Nada ainda.

## Site 1.1 — 2026-11-05

### Adicionado
- Site no ar em https://hb1.layerbros.com e https://layerbros-hb1.pages.dev (Cloudflare Pages).
- `/admin` e URLs de prévia protegidos pelo Cloudflare Access (login com código por e-mail).
- Produção: atalhos para **Início** e **Recalibrar** no cabeçalho.
- Início: animação de um cabo USB-C conectando no freio quando não há freio conectado.
- `wrangler.jsonc` para deploy alternativo como Worker de arquivos estáticos.
- `tools/screenshots.mjs` e prints das telas em `docs/img/`.

### Alterado
- Início conectado: dados da placa em duas colunas, com o ID da placa numa linha inteira (antes quebrava em duas linhas e sobrava um card sozinho).
- CSP aceita estilos inline nos atributos `style` (necessário para o layout atual).

### Removido
- Faixa de avisos animada no topo do Início.

## Firmware 1.0.0 · Site 1.0 — 2026-11-05

Primeira versão.

### Firmware
- Joystick USB com eixo X (0–4095) e um botão (aciona a partir de 50 %).
- Porta serial de configuração com protocolo texto → JSON (`INFO`, `STREAM`, `CAL`, `SET`, `SAVE`, `LOAD`, `BOOTSEL`, `REBOOT`).
- Leitura do 49E com 16× sobreamostragem, filtro EMA e medida de ruído.
- Zona morta fixa de 2 % em cada ponta.
- Calibração, número de série e data de fabricação no último setor da flash, com CRC32. Sobrevivem a atualizações de firmware.
- ID único da placa como número de série USB.
- LED de status: laranja piscando (sem calibração), verde (pronto), laranja acompanhando a alavanca (conectado ao site), verde piscando (salvou).
- Reinício em modo BOOT por comando ou abrindo a porta a 1200 baud.

### Site
- Início: conexão, teste ao vivo, dados da placa e "Copiar dados para o suporte".
- Recalibrar: assistente de 3 passos com validação de curso mínimo.
- Produção (`/admin`): gravação de firmware por WebUSB/PICOBOOT com verificação, calibração, número de série sequencial, data de fabricação, lista da sessão e CSV.
