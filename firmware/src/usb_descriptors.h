#pragma once
#include <stdint.h>

// Relatório HID enviado ao PC. Precisa casar com desc_hid_report.
typedef struct __attribute__((packed)) {
    uint16_t x;       // 0..HB1_AXIS_MAX
    uint8_t buttons;  // bit 0 = botão 1
} hb1_report_t;

// ID único da placa (16 caracteres hexadecimais), também usado como serial USB.
const char *usb_serial_string(void);
