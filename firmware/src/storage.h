#pragma once
#include <stdbool.h>
#include <stdint.h>

#define HB1_SERIAL_MAX 24  // inclui o terminador
#define HB1_MFG_MAX    11  // "AAAA-MM-DD" + terminador

// Configuração persistida no último setor da flash (4 KB).
// O site grava o firmware só nos setores do .uf2, então este setor
// sobrevive a atualizações de firmware.
typedef struct {
    int32_t cal_min;
    int32_t cal_max;
    bool calibrated;
    char serial[HB1_SERIAL_MAX];
    char mfg[HB1_MFG_MAX];
} hb1_config_t;

// Carrega da flash. Se não houver dados válidos, preenche com o padrão e retorna false.
bool storage_load(hb1_config_t *cfg);

// Grava na flash. Retorna false se a gravação falhar.
bool storage_save(const hb1_config_t *cfg);

void storage_defaults(hb1_config_t *cfg);
