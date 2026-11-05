// Leitura do hall 49E: 16 amostras por milissegundo + média móvel exponencial.
#include "sensor.h"

#include "hardware/adc.h"
#include "pico/stdlib.h"
#include "tusb.h"

#include "config.h"

#define OVERSAMPLE 16
#define EMA_SHIFT  2   // alfa = 1/4
#define NOISE_WINDOW_MS 250

static uint32_t ema_q8;          // valor filtrado com 8 bits fracionários
static uint16_t filtered;
static absolute_time_t next_sample;

static uint16_t win_min = 0xFFFF, win_max;
static uint16_t noise_last;
static uint32_t win_count;

void sensor_init(void) {
    adc_init();
    adc_gpio_init(HB1_SENSOR_GPIO);
    adc_select_input(HB1_SENSOR_ADC);

    uint32_t acc = 0;
    for (int i = 0; i < OVERSAMPLE; i++) acc += adc_read();
    filtered = (uint16_t)(acc / OVERSAMPLE);
    ema_q8 = (uint32_t)filtered << 8;
    next_sample = get_absolute_time();
}

static void sample_once(void) {
    uint32_t acc = 0;
    for (int i = 0; i < OVERSAMPLE; i++) acc += adc_read();
    uint32_t value_q8 = (acc << 8) / OVERSAMPLE;

    // ema += (valor - ema) / 4
    int32_t diff = (int32_t)value_q8 - (int32_t)ema_q8;
    ema_q8 = (uint32_t)((int32_t)ema_q8 + (diff >> EMA_SHIFT));
    filtered = (uint16_t)((ema_q8 + 128) >> 8);
    if (filtered > 4095) filtered = 4095;

    if (filtered < win_min) win_min = filtered;
    if (filtered > win_max) win_max = filtered;
    if (++win_count >= NOISE_WINDOW_MS) {
        noise_last = (uint16_t)((win_max - win_min + 1) / 2);
        win_min = 0xFFFF;
        win_max = 0;
        win_count = 0;
    }
}

void sensor_task(void) {
    absolute_time_t now = get_absolute_time();
    if (absolute_time_diff_us(next_sample, now) < 0) return;
    next_sample = delayed_by_ms(next_sample, 1);
    // Se atrasou muito (ex.: gravação na flash), realinha em vez de recuperar.
    if (absolute_time_diff_us(next_sample, now) > 10000) next_sample = delayed_by_ms(now, 1);
    sample_once();
}

uint16_t sensor_raw(void) { return filtered; }

uint16_t sensor_noise(void) { return noise_last; }

uint16_t sensor_average(uint32_t n_ms) {
    uint32_t acc = 0;
    for (uint32_t i = 0; i < n_ms; i++) {
        sleep_ms(1);
        sample_once();
        acc += filtered;
        tud_task();
    }
    return (uint16_t)((acc + n_ms / 2) / n_ms);
}
