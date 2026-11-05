#include "storage.h"

#include <stddef.h>
#include <string.h>

#include "hardware/flash.h"
#include "pico/flash.h"

#include "config.h"

#define STORAGE_MAGIC   0x31424C48u  // "HLB1"
#define STORAGE_VERSION 1
#define STORAGE_OFFSET  (PICO_FLASH_SIZE_BYTES - FLASH_SECTOR_SIZE)

typedef struct {
    uint32_t magic;
    uint16_t version;
    uint16_t size;
    hb1_config_t cfg;
    uint32_t crc;
} record_t;

_Static_assert(sizeof(record_t) <= FLASH_PAGE_SIZE, "record must fit in one flash page");

static uint32_t crc32(const uint8_t *data, size_t len) {
    uint32_t crc = 0xFFFFFFFFu;
    for (size_t i = 0; i < len; i++) {
        crc ^= data[i];
        for (int b = 0; b < 8; b++) crc = (crc >> 1) ^ (0xEDB88320u & (uint32_t)-(int32_t)(crc & 1));
    }
    return ~crc;
}

void storage_defaults(hb1_config_t *cfg) {
    memset(cfg, 0, sizeof(*cfg));
    cfg->cal_min = HB1_CAL_DEFAULT_MIN;
    cfg->cal_max = HB1_CAL_DEFAULT_MAX;
    cfg->calibrated = false;
}

bool storage_load(hb1_config_t *cfg) {
    const record_t *rec = (const record_t *)(XIP_BASE + STORAGE_OFFSET);
    if (rec->magic != STORAGE_MAGIC || rec->version != STORAGE_VERSION ||
        rec->size != sizeof(hb1_config_t) ||
        rec->crc != crc32((const uint8_t *)&rec->cfg, sizeof(hb1_config_t))) {
        storage_defaults(cfg);
        return false;
    }
    memcpy(cfg, &rec->cfg, sizeof(*cfg));
    cfg->serial[HB1_SERIAL_MAX - 1] = 0;
    cfg->mfg[HB1_MFG_MAX - 1] = 0;
    return true;
}

static uint8_t page_buf[FLASH_PAGE_SIZE] __attribute__((aligned(4)));

static void do_write(void *param) {
    (void)param;
    flash_range_erase(STORAGE_OFFSET, FLASH_SECTOR_SIZE);
    flash_range_program(STORAGE_OFFSET, page_buf, FLASH_PAGE_SIZE);
}

bool storage_save(const hb1_config_t *cfg) {
    record_t rec;
    memset(&rec, 0, sizeof(rec));
    rec.magic = STORAGE_MAGIC;
    rec.version = STORAGE_VERSION;
    rec.size = sizeof(hb1_config_t);
    rec.cfg = *cfg;
    rec.crc = crc32((const uint8_t *)&rec.cfg, sizeof(hb1_config_t));

    memset(page_buf, 0xFF, sizeof(page_buf));
    memcpy(page_buf, &rec, sizeof(rec));

    if (flash_safe_execute(do_write, NULL, 500) != PICO_OK) return false;

    hb1_config_t check;
    return storage_load(&check) && memcmp(&check, cfg, sizeof(check)) == 0;
}
