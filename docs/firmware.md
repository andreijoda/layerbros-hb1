# Firmware

C com **Pico SDK 2.1.1** e **TinyUSB**. Placa: `waveshare_rp2040_zero`.

## Compilar

Pré-requisitos (Ubuntu/Debian/WSL):

```bash
sudo apt install cmake gcc-arm-none-eabi libnewlib-arm-none-eabi libstdc++-arm-none-eabi-newlib
```

```bash
git clone --depth 1 --branch 2.1.1 https://github.com/raspberrypi/pico-sdk.git ~/pico-sdk
```

```bash
git -C ~/pico-sdk submodule update --init --depth 1 lib/tinyusb
```

Build:

```bash
export PICO_SDK_PATH=~/pico-sdk
```

```bash
cmake -S firmware -B firmware/build -DCMAKE_BUILD_TYPE=Release && cmake --build firmware/build -j
```

Saída: `firmware/build/hb1.uf2`.

No Windows sem WSL, o instalador oficial "Pico SDK for Windows" ou a extensão "Raspberry Pi Pico" do VS Code trazem tudo pronto.

## Gravar à mão (sem o site)

1. Segure **BOOT** na RP2040-Zero e conecte o USB.
2. Aparece um pendrive **RPI-RP2**.
3. Arraste o `hb1.uf2` para ele. A placa reinicia sozinha.

## Publicar uma versão nova

1. Mude `HB1_FW_VERSION` em `firmware/src/config.h`.
2. Rode:

```bash
PICO_SDK_PATH=~/pico-sdk tools/release-firmware.sh
```

3. Isso gera `web/firmware/hb1-<versão>.uf2` e atualiza o `manifest.json` (com sha256). A produção sempre grava o `latest` do manifest e confere o hash antes.
4. Registre no `CHANGELOG.md`, faça o commit dos dois arquivos e o deploy.

O CI compila o firmware em todo push e falha se o manifest não estiver na versão do `config.h`.

## Estrutura

| Arquivo | Papel |
|---|---|
| `config.h` | Versão, USB VID/PID, pinos, calibração padrão, zona morta, limiar do botão |
| `main.c` | Inicialização, loop, envio do relatório HID, callbacks TinyUSB |
| `sensor.c` | ADC a cada 1 ms: 16 amostras, média, EMA (α = 1/4), ruído pico-a-pico em 250 ms |
| `protocol.c` | Protocolo serial ([protocolo-serial.md](protocolo-serial.md)) e conversão leitura → posição |
| `storage.c` | Configuração persistente com CRC32 |
| `usb_descriptors.c` | Dispositivo composto CDC + HID e strings USB |
| `led.c` + `ws2812.pio` | LED de status |

## Da leitura ao joystick

```
ADC (0–4095) ─▶ média de 16 ─▶ EMA ─▶ raw
raw ─▶ (raw − min) / (max − min) ─▶ zona morta 2 % em cada ponta ─▶ 0–1000 ‰
‰ ─▶ eixo X 0–4095   e   botão 1 = ‰ ≥ 500
```

O relatório HID é enviado quando muda, e a cada 100 ms mesmo parado. Intervalo USB de 1 ms.

## Memória

| Região | Uso |
|---|---|
| `0x10000000` … | Firmware (~37 KB) |
| último setor (`0x101FF000`, 4 KB) | Configuração: `hb1_config_t` + magic + versão + CRC32 |

A gravação pelo site apaga e grava **só os setores do `.uf2`**, então calibração, série e data sobrevivem a atualizações.

Ao mudar `hb1_config_t`: incremente `STORAGE_VERSION` e escreva a migração em `storage_load()`. Sem isso, toda unidade em campo volta para "não calibrado".

## Modo BOOT

- Comando serial `BOOTSEL`, ou abrir a porta a **1200 baud**, reinicia a placa no bootloader USB da ROM (pendrive RPI-RP2 + interface PICOBOOT).
- O botão BOOT físico também funciona (segurar ao conectar).
