// Protocolo serial do HB-1: comandos em texto (uma linha), respostas em JSON (uma linha).
// Especificação completa em docs/protocolo-serial.md.
#include "protocol.h"

#include <ctype.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "pico/stdlib.h"
#include "tusb.h"

#include "config.h"
#include "led.h"
#include "sensor.h"
#include "usb_descriptors.h"

hb1_state_t g_state;

static char line[128];
static size_t line_len;
static bool line_overflow;
static absolute_time_t next_stream;

// ------------------------------------------------------------------ util

static void send(const char *fmt, ...) {
    char buf[256];
    va_list ap;
    va_start(ap, fmt);
    int n = vsnprintf(buf, sizeof(buf) - 1, fmt, ap);
    va_end(ap);
    if (n < 0) return;
    if (n > (int)sizeof(buf) - 2) n = sizeof(buf) - 2;
    buf[n++] = '\n';

    // Se ninguém está lendo, não trava o loop: escreve o que couber.
    int off = 0;
    absolute_time_t deadline = make_timeout_time_ms(50);
    while (off < n && tud_cdc_connected()) {
        uint32_t avail = tud_cdc_write_available();
        if (avail == 0) {
            tud_task();
            if (time_reached(deadline)) break;
            continue;
        }
        uint32_t chunk = (uint32_t)(n - off) < avail ? (uint32_t)(n - off) : avail;
        off += (int)tud_cdc_write(buf + off, chunk);
    }
    tud_cdc_write_flush();
}

static void send_ok(void) { send("{\"t\":\"ok\"}"); }

static void send_err(const char *code) { send("{\"t\":\"err\",\"code\":\"%s\"}", code); }

uint16_t hb1_position_permille(uint16_t raw) {
    int32_t lo = g_state.cfg.cal_min, hi = g_state.cfg.cal_max;
    int32_t span = hi - lo;  // pode ser negativo se o ímã estiver invertido
    if (span == 0) return 0;
    int32_t p = ((int32_t)raw - lo) * 1000 / span;
    // Zona morta nas pontas e reescala para 0..1000.
    int32_t a = HB1_DEADZONE_LOW_PERMILLE, b = 1000 - HB1_DEADZONE_HIGH_PERMILLE;
    p = (p - a) * 1000 / (b - a);
    if (p < 0) p = 0;
    if (p > 1000) p = 1000;
    return (uint16_t)p;
}

static void send_info(void) {
    send("{\"t\":\"info\",\"fw\":\"%s\",\"uid\":\"%s\",\"serial\":\"%s\",\"mfg\":\"%s\","
         "\"min\":%ld,\"max\":%ld,\"cal\":%s}",
         HB1_FW_VERSION, usb_serial_string(), g_state.cfg.serial, g_state.cfg.mfg,
         (long)g_state.cfg.cal_min, (long)g_state.cfg.cal_max,
         g_state.cfg.calibrated ? "true" : "false");
}

static void send_sample(void) {
    uint16_t raw = sensor_raw();
    uint16_t p = hb1_position_permille(raw);
    send("{\"t\":\"s\",\"raw\":%u,\"pct\":%u.%u,\"noise\":%u}", raw, p / 10, p % 10, sensor_noise());
}

static bool valid_serial(const char *s) {
    size_t n = strlen(s);
    if (n == 0 || n >= HB1_SERIAL_MAX) return false;
    for (size_t i = 0; i < n; i++) {
        char c = s[i];
        if (!(isupper((unsigned char)c) || isdigit((unsigned char)c) || c == '-')) return false;
    }
    return true;
}

static bool valid_date(const char *s) {
    // AAAA-MM-DD
    if (strlen(s) != 10 || s[4] != '-' || s[7] != '-') return false;
    for (int i = 0; i < 10; i++) {
        if (i == 4 || i == 7) continue;
        if (!isdigit((unsigned char)s[i])) return false;
    }
    int m = atoi(s + 5), d = atoi(s + 8);
    return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

static bool parse_int(const char *s, int32_t *out) {
    if (!s || !*s) return false;
    char *end;
    long v = strtol(s, &end, 10);
    if (*end) return false;
    *out = (int32_t)v;
    return true;
}

static bool range_ok(void) {
    return abs(g_state.cfg.cal_max - g_state.cfg.cal_min) >= HB1_CAL_MIN_RANGE;
}

// ------------------------------------------------------------------ comandos

static void handle(char *cmd) {
    // Separa em até 3 palavras: VERBO ALVO VALOR
    char *argv[3] = {0};
    int argc = 0;
    for (char *tok = strtok(cmd, " \t"); tok && argc < 3; tok = strtok(NULL, " \t")) argv[argc++] = tok;
    if (argc == 0) return;
    for (char *p = argv[0]; *p; p++) *p = (char)toupper((unsigned char)*p);
    if (argc > 1)
        for (char *p = argv[1]; *p; p++) *p = (char)toupper((unsigned char)*p);

    const char *v = argv[0], *a = argc > 1 ? argv[1] : "", *val = argc > 2 ? argv[2] : NULL;

    if (!strcmp(v, "INFO")) {
        send_info();
    } else if (!strcmp(v, "READ")) {
        send_sample();
    } else if (!strcmp(v, "STREAM")) {
        if (!strcmp(a, "ON")) { g_state.stream = true; led_set_mode(LED_LIVE); }
        else if (!strcmp(a, "OFF")) {
            g_state.stream = false;
            led_set_mode(g_state.cfg.calibrated ? LED_READY : LED_UNCALIBRATED);
        } else { send_err("arg"); return; }
        send_ok();
    } else if (!strcmp(v, "CAL")) {
        // Captura a média de 200 ms da leitura atual.
        if (strcmp(a, "MIN") && strcmp(a, "MAX")) { send_err("arg"); return; }
        uint16_t avg = sensor_average(200);
        if (!strcmp(a, "MIN")) g_state.cfg.cal_min = avg; else g_state.cfg.cal_max = avg;
        send("{\"t\":\"cal\",\"which\":\"%s\",\"value\":%u}", !strcmp(a, "MIN") ? "min" : "max", avg);
    } else if (!strcmp(v, "SET")) {
        if (!val) { send_err("arg"); return; }
        int32_t n;
        if (!strcmp(a, "MIN") || !strcmp(a, "MAX")) {
            if (!parse_int(val, &n) || n < 0 || n > 4095) { send_err("arg"); return; }
            if (!strcmp(a, "MIN")) g_state.cfg.cal_min = n; else g_state.cfg.cal_max = n;
            send_ok();
        } else if (!strcmp(a, "SERIAL") || !strcmp(a, "SERIAL!")) {
            if (!valid_serial(val)) { send_err("serial_format"); return; }
            // Série só é trocada com "SERIAL!" depois de gravada (evita apagar por engano).
            if (g_state.cfg.serial[0] && strcmp(a, "SERIAL!")) { send_err("serial_locked"); return; }
            strncpy(g_state.cfg.serial, val, HB1_SERIAL_MAX - 1);
            g_state.cfg.serial[HB1_SERIAL_MAX - 1] = 0;
            send_ok();
        } else if (!strcmp(a, "MFG")) {
            if (!valid_date(val)) { send_err("date_format"); return; }
            strncpy(g_state.cfg.mfg, val, HB1_MFG_MAX - 1);
            g_state.cfg.mfg[HB1_MFG_MAX - 1] = 0;
            send_ok();
        } else {
            send_err("arg");
        }
    } else if (!strcmp(v, "SAVE")) {
        if (!range_ok()) { send_err("range"); return; }
        g_state.cfg.calibrated = true;
        if (!storage_save(&g_state.cfg)) { send_err("flash"); return; }
        led_set_mode(LED_SAVED);
        send("{\"t\":\"ok\",\"saved\":true}");
    } else if (!strcmp(v, "LOAD")) {
        // Descarta mudanças não salvas.
        storage_load(&g_state.cfg);
        send_ok();
    } else if (!strcmp(v, "BOOTSEL")) {
        send_ok();
        g_state.bootsel_requested = true;
    } else if (!strcmp(v, "REBOOT")) {
        send_ok();
        g_state.reboot_requested = true;
    } else {
        send_err("unknown");
    }
}

// ------------------------------------------------------------------ loop

void protocol_on_connect(bool connected) {
    line_len = 0;
    line_overflow = false;
    if (!connected) {
        // Site fechou sem salvar: volta para o que está na flash.
        g_state.stream = false;
        storage_load(&g_state.cfg);
        led_set_mode(g_state.cfg.calibrated ? LED_READY : LED_UNCALIBRATED);
    }
}

void protocol_task(void) {
    while (tud_cdc_available()) {
        char c = (char)tud_cdc_read_char();
        if (c == '\r') continue;
        if (c == '\n') {
            if (!line_overflow) {
                line[line_len] = 0;
                handle(line);
            } else {
                send_err("too_long");
            }
            line_len = 0;
            line_overflow = false;
        } else if (line_len < sizeof(line) - 1) {
            line[line_len++] = c;
        } else {
            line_overflow = true;
        }
    }

    if (g_state.stream && tud_cdc_connected() && time_reached(next_stream)) {
        next_stream = make_timeout_time_ms(HB1_STREAM_INTERVAL_MS);
        send_sample();
    }
}
