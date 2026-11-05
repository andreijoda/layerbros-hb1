# Protocolo serial

Porta CDC "HB-1 Config". A velocidade não importa (USB), exceto **1200 baud**, que reinicia a placa em modo BOOT.

- **Comando:** texto ASCII, uma linha terminada em `\n`. Maiúsculas ou minúsculas.
- **Resposta:** um objeto JSON por linha, sempre com o campo `t` (tipo).
- Cada comando recebe **exatamente uma** resposta, na ordem. As amostras do stream (`t: "s"`) podem chegar intercaladas e não contam como resposta.
- Mudanças de calibração, série e data ficam em RAM até `SAVE`. Se a porta fechar (DTR cai) sem `SAVE`, a placa volta ao que está na flash.

Implementações: `firmware/src/protocol.c` (placa), `web/assets/js/hb1.js` (site), `tools/fake-hb1.js` (simulador). Mantenha as três iguais.

## Comandos

### `INFO`
```json
{"t":"info","fw":"1.0.0","uid":"E6614C311B4F2A35","serial":"LB-HB1-000124","mfg":"2026-11-05","min":612,"max":3480,"cal":true}
```
| Campo | Significado |
|---|---|
| `fw` | Versão do firmware |
| `uid` | ID único da flash da placa (também é o serial USB) |
| `serial` | Número de série LayerBros (`""` se não gravado) |
| `mfg` | Data de fabricação `AAAA-MM-DD` (`""` se não gravada) |
| `min`, `max` | Calibração em uso (RAM) |
| `cal` | `true` se já foi salva alguma calibração |

### `READ`
Uma amostra:
```json
{"t":"s","raw":2048,"pct":51.3,"noise":2}
```
`raw` é a leitura filtrada (0–4095), `pct` a posição calibrada (0–100, uma casa) e `noise` a oscilação ±.

### `STREAM ON` | `STREAM OFF`
Liga/desliga o envio de amostras a cada 20 ms. Resposta `{"t":"ok"}`. Com o stream ligado, o LED acompanha a alavanca.

### `CAL MIN` | `CAL MAX`
Mede a média de 200 ms da leitura atual e usa como repouso (`MIN`) ou puxado (`MAX`).
```json
{"t":"cal","which":"min","value":612}
```

### `SET MIN <n>` | `SET MAX <n>`
Define a calibração diretamente (0–4095). `{"t":"ok"}`.

### `SET SERIAL <texto>`
Grava o número de série (A–Z, 0–9 e `-`, até 23 caracteres). Recusado com `serial_locked` se a placa já tiver série.
`SET SERIAL! <texto>` troca mesmo assim (só para retrabalho).

### `SET MFG <AAAA-MM-DD>`
Data de fabricação.

### `SAVE`
Valida o curso (`|max − min| ≥ 400`), marca como calibrado e grava na flash.
```json
{"t":"ok","saved":true}
```

### `LOAD`
Descarta mudanças não salvas e recarrega da flash. `{"t":"ok"}`.

### `BOOTSEL`
Responde `{"t":"ok"}` e reinicia em modo BOOT (~100 ms depois). A porta serial some.

### `REBOOT`
Responde `{"t":"ok"}` e reinicia normalmente.

## Erros

```json
{"t":"err","code":"range"}
```

| Código | Quando |
|---|---|
| `unknown` | Comando desconhecido |
| `arg` | Argumento ausente ou inválido |
| `too_long` | Linha com mais de 127 caracteres |
| `range` | `SAVE` com curso menor que 400 |
| `flash` | Falha ao gravar na flash |
| `serial_format` | Série com caracteres inválidos |
| `serial_locked` | Placa já tem série (use `SET SERIAL!`) |
| `date_format` | Data fora do formato `AAAA-MM-DD` |

## Testar no terminal

Qualquer terminal serial serve (PuTTY, `screen`, monitor serial do Arduino). No Linux:

```bash
screen /dev/ttyACM0 115200
```

Digite `INFO` e Enter.
