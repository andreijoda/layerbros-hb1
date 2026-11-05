cmake_minimum_required(VERSION 3.13)

# Placa: Waveshare RP2040-Zero (2 MB de flash, LED WS2812 no GPIO16)
set(PICO_BOARD waveshare_rp2040_zero CACHE STRING "Board type")

include(pico_sdk_import.cmake)

project(hb1_firmware C CXX ASM)
set(CMAKE_C_STANDARD 11)
set(CMAKE_CXX_STANDARD 17)

pico_sdk_init()

add_executable(hb1
    src/main.c
    src/usb_descriptors.c
    src/sensor.c
    src/storage.c
    src/protocol.c
    src/led.c
)

pico_generate_pio_header(hb1 ${CMAKE_CURRENT_LIST_DIR}/src/ws2812.pio)

target_include_directories(hb1 PRIVATE ${CMAKE_CURRENT_LIST_DIR}/src)

target_compile_options(hb1 PRIVATE -Wall -Wextra -Wno-unused-parameter)

target_link_libraries(hb1 PRIVATE
    pico_stdlib
    pico_unique_id
    pico_bootrom
    pico_flash
    hardware_adc
    hardware_flash
    hardware_pio
    hardware_watchdog
    tinyusb_device
)

pico_set_program_name(hb1 "LayerBros Handbrake HB-1")
pico_add_extra_outputs(hb1)
