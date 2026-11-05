#pragma once
#include <stdbool.h>
#include <stdint.h>

typedef enum {
    LED_UNCALIBRATED, // laranja piscando devagar
    LED_READY,        // verde fraco
    LED_LIVE,         // conectado ao site: laranja acompanha a alavanca
    LED_SAVED,        // pisca verde 3x após salvar
} led_mode_t;

void led_init(void);
void led_set_mode(led_mode_t mode);
// Chamar no loop. pct_permille = posição atual (0..1000), usada no modo LIVE.
void led_task(uint16_t pct_permille);
