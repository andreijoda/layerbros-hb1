#include "led.h"

#include "hardware/pio.h"
#include "pico/stdlib.h"

#include "config.h"
#include "ws2812.pio.h"

static PIO pio = pio0;
static uint sm;
static led_mode_t mode = LED_UNCALIBRATED;
static led_mode_t mode_after_saved = LED_READY;
static absolute_time_t mode_since;
static absolute_time_t next_update;
static uint32_t last_grb = 0xFFFFFFFF;

// A RP2040-Zero usa ordem RGB no WS2812 (não GRB).
static void put_rgb(uint8_t r, uint8_t g, uint8_t b) {
    uint32_t word = ((uint32_t)r << 16) | ((uint32_t)g << 8) | b;
    if (word == last_grb) return;
    last_grb = word;
    pio_sm_put_blocking(pio, sm, word << 8u);
}

void led_init(void) {
    uint offset = pio_add_program(pio, &ws2812_program);
    sm = pio_claim_unused_sm(pio, true);
    ws2812_program_init(pio, sm, offset, HB1_LED_GPIO, 800000);
    mode_since = get_absolute_time();
    next_update = mode_since;
    put_rgb(0, 0, 0);
}

void led_set_mode(led_mode_t m) {
    if (m == LED_SAVED) {
        mode_after_saved = (mode == LED_SAVED) ? mode_after_saved : mode;
        if (mode_after_saved == LED_UNCALIBRATED) mode_after_saved = LED_READY;
    }
    if (m == mode) return;
    mode = m;
    mode_since = get_absolute_time();
}

void led_task(uint16_t pct) {
    absolute_time_t now = get_absolute_time();
    if (absolute_time_diff_us(next_update, now) < 0) return;
    next_update = delayed_by_ms(now, 20);

    uint32_t t = (uint32_t)(absolute_time_diff_us(mode_since, now) / 1000);

    switch (mode) {
    case LED_UNCALIBRATED: {
        // Laranja da marca (#FF5A1F), brilho baixo, 1 Hz.
        bool on = (t % 1000) < 500;
        if (on) put_rgb(40, 9, 3); else put_rgb(0, 0, 0);
        break;
    }
    case LED_READY:
        put_rgb(0, 10, 2);
        break;
    case LED_LIVE: {
        uint32_t k = 4 + (pct * 60u) / 1000u;
        put_rgb((uint8_t)k, (uint8_t)(k * 9 / 40), (uint8_t)(k * 3 / 40));
        break;
    }
    case LED_SAVED: {
        if (t >= 900) {
            led_set_mode(mode_after_saved);
            break;
        }
        bool on = (t % 300) < 150;
        if (on) put_rgb(0, 50, 10); else put_rgb(0, 0, 0);
        break;
    }
    }
}
