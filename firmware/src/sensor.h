#pragma once
#include <stdint.h>

void sensor_init(void);

// Chamar no loop principal. Lê o ADC a cada 1 ms (sobreamostragem + filtro).
void sensor_task(void);

// Leitura filtrada, 0..4095.
uint16_t sensor_raw(void);

// Oscilação pico a pico / 2 da leitura filtrada nos últimos ~250 ms.
uint16_t sensor_noise(void);

// Média de várias leituras filtradas (bloqueia ~n ms). Usada pelo CAL MIN/MAX.
uint16_t sensor_average(uint32_t n_ms);
