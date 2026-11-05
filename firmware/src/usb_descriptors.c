// Descritores USB do HB-1: dispositivo composto CDC (configuração) + HID (joystick).
#include <string.h>

#include "tusb.h"
#include "pico/unique_id.h"

#include "config.h"
#include "usb_descriptors.h"

// ---------------------------------------------------------------- dispositivo

static const tusb_desc_device_t desc_device = {
    .bLength            = sizeof(tusb_desc_device_t),
    .bDescriptorType    = TUSB_DESC_DEVICE,
    .bcdUSB             = 0x0200,
    // IAD: necessário para composto com CDC.
    .bDeviceClass       = TUSB_CLASS_MISC,
    .bDeviceSubClass    = MISC_SUBCLASS_COMMON,
    .bDeviceProtocol    = MISC_PROTOCOL_IAD,
    .bMaxPacketSize0    = CFG_TUD_ENDPOINT0_SIZE,
    .idVendor           = HB1_USB_VID,
    .idProduct          = HB1_USB_PID,
    .bcdDevice          = 0x0100,
    .iManufacturer      = 0x01,
    .iProduct           = 0x02,
    .iSerialNumber      = 0x03,
    .bNumConfigurations = 0x01,
};

uint8_t const *tud_descriptor_device_cb(void) {
    return (uint8_t const *)&desc_device;
}

// ---------------------------------------------------------------- HID report

// Um eixo X de 16 bits (0..4095) e um botão. Ver hb1_report_t em usb_descriptors.h.
static const uint8_t desc_hid_report[] = {
    0x05, 0x01,       // Usage Page (Generic Desktop)
    0x09, 0x04,       // Usage (Joystick)
    0xA1, 0x01,       // Collection (Application)
    0x09, 0x01,       //   Usage (Pointer)
    0xA1, 0x00,       //   Collection (Physical)
    0x09, 0x30,       //     Usage (X)
    0x15, 0x00,       //     Logical Minimum (0)
    0x26, 0xFF, 0x0F, //     Logical Maximum (4095)
    0x75, 0x10,       //     Report Size (16)
    0x95, 0x01,       //     Report Count (1)
    0x81, 0x02,       //     Input (Data, Var, Abs)
    0xC0,             //   End Collection
    0x05, 0x09,       //   Usage Page (Button)
    0x19, 0x01,       //   Usage Minimum (1)
    0x29, 0x01,       //   Usage Maximum (1)
    0x15, 0x00,       //   Logical Minimum (0)
    0x25, 0x01,       //   Logical Maximum (1)
    0x75, 0x01,       //   Report Size (1)
    0x95, 0x01,       //   Report Count (1)
    0x81, 0x02,       //   Input (Data, Var, Abs)
    0x75, 0x07,       //   Report Size (7)  padding
    0x95, 0x01,       //   Report Count (1)
    0x81, 0x03,       //   Input (Const)
    0xC0,             // End Collection
};

uint8_t const *tud_hid_descriptor_report_cb(uint8_t instance) {
    (void)instance;
    return desc_hid_report;
}

// ---------------------------------------------------------------- configuração

enum {
    ITF_NUM_CDC = 0,
    ITF_NUM_CDC_DATA,
    ITF_NUM_HID,
    ITF_NUM_TOTAL
};

#define EPNUM_CDC_NOTIF 0x81
#define EPNUM_CDC_OUT   0x02
#define EPNUM_CDC_IN    0x82
#define EPNUM_HID       0x83

#define CONFIG_TOTAL_LEN (TUD_CONFIG_DESC_LEN + TUD_CDC_DESC_LEN + TUD_HID_DESC_LEN)

static const uint8_t desc_configuration[] = {
    TUD_CONFIG_DESCRIPTOR(1, ITF_NUM_TOTAL, 0, CONFIG_TOTAL_LEN, 0x00, 100),
    TUD_CDC_DESCRIPTOR(ITF_NUM_CDC, 4, EPNUM_CDC_NOTIF, 8, EPNUM_CDC_OUT, EPNUM_CDC_IN, 64),
    // bInterval 1 ms
    TUD_HID_DESCRIPTOR(ITF_NUM_HID, 5, HID_ITF_PROTOCOL_NONE, sizeof(desc_hid_report),
                       EPNUM_HID, CFG_TUD_HID_EP_BUFSIZE, 1),
};

uint8_t const *tud_descriptor_configuration_cb(uint8_t index) {
    (void)index;
    return desc_configuration;
}

// ---------------------------------------------------------------- strings

static char serial_str[2 * PICO_UNIQUE_BOARD_ID_SIZE_BYTES + 1];

static const char *string_desc[] = {
    NULL,                 // 0: idioma (tratado abaixo)
    HB1_USB_MANUFACTURER, // 1
    HB1_USB_PRODUCT,      // 2
    serial_str,           // 3: ID único da flash da placa
    "HB-1 Config",        // 4: interface CDC
    "HB-1 Joystick",      // 5: interface HID
};

const char *usb_serial_string(void) {
    if (!serial_str[0]) {
        pico_get_unique_board_id_string(serial_str, sizeof(serial_str));
    }
    return serial_str;
}

static uint16_t desc_str[32 + 1];

uint16_t const *tud_descriptor_string_cb(uint8_t index, uint16_t langid) {
    (void)langid;
    size_t count;

    if (index == 0) {
        desc_str[1] = 0x0409;
        count = 1;
    } else {
        if (index >= sizeof(string_desc) / sizeof(string_desc[0])) return NULL;
        const char *str = (index == 3) ? usb_serial_string() : string_desc[index];
        count = strlen(str);
        if (count > 32) count = 32;
        for (size_t i = 0; i < count; i++) desc_str[1 + i] = (uint8_t)str[i];
    }

    desc_str[0] = (uint16_t)((TUSB_DESC_STRING << 8) | (2 * count + 2));
    return desc_str;
}
