#pragma once

// Versão do firmware. Mude aqui e em web/firmware/manifest.json (ver docs/firmware.md).
#define HB1_FW_VERSION "1.0.0"

// USB. O VID 0x2E8A é da Raspberry Pi. O PID abaixo é PROVISÓRIO:
// peça um PID próprio em https://github.com/raspberrypi/usb-pid antes de vender
// em escala e atualize também web/assets/js/hb1.js (HB1_USB_FILTER).
#define HB1_USB_VID 0x2E8A
#define HB1_USB_PID 0x10C8

#define HB1_USB_MANUFACTURER "LayerBros"
#define HB1_USB_PRODUCT      "Handbrake HB-1"

// Sensor hall 49E ligado no GPIO26 (ADC0).
#define HB1_SENSOR_GPIO 26
#define HB1_SENSOR_ADC  0

// LED WS2812 da RP2040-Zero.
#define HB1_LED_GPIO 16

// Calibração padrão (placa nunca calibrada) e curso mínimo aceito.
#define HB1_CAL_DEFAULT_MIN 0
#define HB1_CAL_DEFAULT_MAX 4095
#define HB1_CAL_MIN_RANGE   400

// Zona morta fixa em cada ponta, em décimos de por cento (20 = 2,0 %).
// Garante 0 % com a alavanca solta e 100 % no batente mesmo com ruído.
#define HB1_DEADZONE_LOW_PERMILLE  20
#define HB1_DEADZONE_HIGH_PERMILLE 20

// Saída HID: eixo X de 0 a 4095. O botão 1 aciona a partir deste ponto.
#define HB1_AXIS_MAX           4095
#define HB1_BUTTON_THRESHOLD_PERMILLE 500

// Intervalo do stream serial (ms).
#define HB1_STREAM_INTERVAL_MS 20
