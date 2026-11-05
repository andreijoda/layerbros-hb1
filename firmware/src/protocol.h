#pragma once
#include <stdbool.h>
#include <stdint.h>

#include "storage.h"

// Estado compartilhado entre o loop principal e o protocolo serial.
typedef struct {
    hb1_config_t cfg;        // configuração em uso (RAM)
    bool stream;             // envia leituras periódicas
    bool bootsel_requested;  // reiniciar em modo BOOT após responder
    bool reboot_requested;
} hb1_state_t;

extern hb1_state_t g_state;

// Converte a leitura bruta em posição 0..1000 (décimos de %) usando a calibração atual.
uint16_t hb1_position_permille(uint16_t raw);

// Processa bytes recebidos pelo CDC e envia stream quando ativo. Chamar no loop.
void protocol_task(void);

// Chamado quando o site abre/fecha a porta (DTR).
void protocol_on_connect(bool connected);
