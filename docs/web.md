# Site

HTML, CSS e módulos ES puros. **Sem build e sem dependências.** A pasta `web/` é publicada como está.

## Páginas

| Caminho | Quem usa | O que faz |
|---|---|---|
| `/` | Cliente | Conecta, mostra a posição ao vivo, dados da placa, "Copiar dados para o suporte". Reconecta sozinho se o freio já foi autorizado. |
| `/recalibrar/` | Cliente | Conectar → soltar (`CAL MIN`) → puxar (`CAL MAX`) → testar → `SAVE` |
| `/admin/` | Produção | Ver [producao.md](producao.md). Protegida pelo Cloudflare Access. |

## Módulos

| Arquivo | Papel |
|---|---|
| `assets/js/hb1.js` | Classe `HB1`: Web Serial, fila de comandos, eventos `sample` e `disconnect` |
| `assets/js/picoboot.js` | Classe `Picoboot`: WebUSB + protocolo PICOBOOT do bootrom (apagar, gravar, verificar, reiniciar) |
| `assets/js/uf2.js` | `parseUF2()`: converte o `.uf2` em setores de 4 KB |
| `assets/js/ui.js` | Etapas, medidores, efeitos, mensagens de erro em português |
| `assets/js/home.js`, `recalibrar.js`, `admin.js` | Lógica de cada página |
| `assets/css/lb.css` | Tokens LayerBros (claro e escuro) e componentes |

## Navegadores

| | Web Serial (cliente) | WebUSB (produção) |
|---|---|---|
| Chrome / Edge no computador | Sim | Sim |
| Opera | Sim | Sim |
| Firefox, Safari | Não | Não |
| Celular | Não | Não (Android tem WebUSB, mas não Web Serial) |

As páginas mostram um aviso e desativam os botões quando a API não existe. As APIs exigem HTTPS ou `localhost`.

## Gravação de firmware (PICOBOOT)

Em modo BOOT a RP2040 expõe uma interface USB vendor (classe `0xFF`) com o protocolo PICOBOOT, o mesmo do `picotool`. A sequência em `picoboot.js`:

1. `INTERFACE_RESET` (controle).
2. `EXCLUSIVE_ACCESS` (trava o pendrive RPI-RP2 durante a gravação).
3. `EXIT_XIP`.
4. Para cada setor de 4 KB do `.uf2`: `FLASH_ERASE` e `WRITE`.
5. `READ` de cada setor e comparação byte a byte.
6. `REBOOT`.

O ID único da placa vem do número de série USB tanto no modo BOOT quanto no firmware. A produção compara os dois para garantir que calibra a mesma placa que acabou de gravar.

## Desenvolvimento

```bash
npm run dev
```

Testes de ponta a ponta sem hardware (Playwright + Chromium):

```bash
node tools/e2e.mjs
```

O `tools/fake-hb1.js` substitui `navigator.serial` por uma porta falsa que segue o protocolo. No teste, `window.__hb1.raw` simula a alavanca. A gravação USB não é simulada: teste com uma placa real.

## Segurança

- `web/_headers` define CSP estrita (só scripts do próprio site; fontes do Google), `Permissions-Policy` liberando `serial` e `usb` só para o próprio site, e `noindex` no `/admin`.
- O `/admin` não tem senha no código: a proteção é do Cloudflare Access ([deploy.md](deploy.md)).
- O site não envia dados para servidor nenhum. A lista da produção fica no `localStorage` do navegador do operador.
