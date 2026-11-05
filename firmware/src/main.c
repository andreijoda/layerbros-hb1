// LayerBros Handbrake HB-1: freio de mão USB para simulador.
// RP2040-Zero + sensor hall 49E. Aparece no PC como joystick (HID) e como
// porta serial (CDC) usada pelo site para calibrar.
#include <string.h>

#include "hardware/watchdog.h"
#include "pico/bootrom.h"
#include "pico/stdlib.h"
#include "tusb.h"

#include "config.h"
#include "led.h"
#include "protocol.h"
#include "sensor.h"
#include "storage.h"
#include "usb_descriptors.h"

static hb1_report_t last_report = {.x = 0xFFFF};
static absolute_time_t next_keepalive;

static void hid_task(void) {
    if (!tud_hid_ready()) return;

    uint16_t p = hb1_position_permille(sensor_raw());
    hb1_report_t r = {
        .x = (uint16_t)((uint32_t)p * HB1_AXIS_MAX / 1000u),
        .buttons = p >= HB1_BUTTON_THRESHOLD_PERMILLE ? 1 : 0,
    };

    // Envia quando muda, e a cada 100 ms mesmo parado.
    if (memcmp(&r, &last_report, sizeof(r)) == 0 && !time_reached(next_keepalive)) return;
    if (tud_hid_report(0, &r, sizeof(r))) {
        last_report = r;
        next_keepalive = make_timeout_time_ms(100);
    }
}

int main(void) {
    // A configuração em RAM começa igual à da flash.
    storage_load(&g_state.cfg);

    usb_serial_string();  // lê o ID único antes de qualquer acesso à flash
    sensor_init();
    led_init();
    led_set_mode(g_state.cfg.calibrated ? LED_READY : LED_UNCALIBRATED);

    tusb_init();

    while (true) {
        tud_task();
        sensor_task();
        hid_task();
        protocol_task();
        led_task(hb1_position_permille(sensor_raw()));

        if (g_state.bootsel_requested) {
            // Dá tempo de a resposta "ok" sair antes de reiniciar.
            absolute_time_t until = make_timeout_time_ms(100);
            while (!time_reached(until)) tud_task();
            reset_usb_boot(0, 0);
        }
        if (g_state.reboot_requested) {
            absolute_time_t until = make_timeout_time_ms(100);
            while (!time_reached(until)) tud_task();
            watchdog_reboot(0, 0, 0);
            while (true) tight_loop_contents();
        }
    }
}

// ------------------------------------------------------------------ callbacks TinyUSB

void tud_cdc_line_state_cb(uint8_t itf, bool dtr, bool rts) {
    (void)itf;
    (void)rts;
    if (dtr) tud_cdc_write_clear();
    protocol_on_connect(dtr);
}

// Abrir a porta a 1200 baud também reinicia em modo BOOT (convenção Arduino).
void tud_cdc_line_coding_cb(uint8_t itf, cdc_line_coding_t const *coding) {
    (void)itf;
    if (coding->bit_rate == 1200) g_state.bootsel_requested = true;
}

uint16_t tud_hid_get_report_cb(uint8_t instance, uint8_t report_id, hid_report_type_t report_type,
                               uint8_t *buffer, uint16_t reqlen) {
    (void)instance;
    (void)report_id;
    (void)report_type;
    if (reqlen < sizeof(last_report)) return 0;
    memcpy(buffer, &last_report, sizeof(last_report));
    return sizeof(last_report);
}

void tud_hid_set_report_cb(uint8_t instance, uint8_t report_id, hid_report_type_t report_type,
                           uint8_t const *buffer, uint16_t bufsize) {
    (void)instance;
    (void)report_id;
    (void)report_type;
    (void)buffer;
    (void)bufsize;
}
