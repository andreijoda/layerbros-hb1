# Hardware

## Peças

| Peça | Observação |
|---|---|
| Waveshare **RP2040-Zero** | 2 MB de flash, USB-C, LED WS2812 no GPIO16, botão BOOT |
| Sensor hall linear **49E** (SS49E / OH49E) | Saída analógica proporcional ao campo; funciona de 2,7 a 6,5 V |
| Ímã de neodímio | Preso na alavanca, passando na frente do sensor |
| Cabo USB-C **de dados** | Cabos só de carga não aparecem no PC |

## Ligação

```
49E (face com as letras para você)       RP2040-Zero
  pino 1  VCC  ───────────────────────── 3V3
  pino 2  GND  ───────────────────────── GND
  pino 3  OUT  ───────────────────────── GP26 (ADC0)
```

- Alimente o 49E com **3V3**, nunca 5V: a saída precisa ficar dentro da faixa do ADC (0–3,3 V).
- Opcional e recomendado: capacitor de 100 nF entre VCC e GND, perto do sensor.
- Fio do sensor curto ou trançado com o GND, longe do motor ou de cabos de força.

O pino está em `HB1_SENSOR_GPIO` (`firmware/src/config.h`).

## Ímã e curso

- Sem campo, o 49E fica em ~1,65 V (leitura ~2048). Um polo do ímã sobe a leitura, o outro desce. **Os dois sentidos funcionam**: a calibração aceita repouso maior que puxado.
- Curso mínimo aceito: **400** pontos entre repouso e puxado (`HB1_CAL_MIN_RANGE`). Se a calibração reclamar de curso curto, aproxime o ímã ou use um mais forte.
- Bom alvo: repouso perto de 600 e puxado acima de 3400, com a leitura parada variando menos de ±6 ("Sinal do sensor: Estável" no site).
- Evite o ímã encostar no sensor no batente: a saída satura e a ponta do curso fica "morta".

## LED de status

| Cor | Significado |
|---|---|
| Laranja piscando devagar | Nunca calibrado |
| Verde fraco | Pronto para jogar |
| Laranja que acende conforme puxa | Conectado ao site (teste ao vivo) |
| Verde piscando 3× | Calibração salva |

A cor do WS2812 da RP2040-Zero pode vir em ordem RGB ou GRB conforme o lote. Se o "laranja" aparecer verde, troque a ordem em `put_rgb()` (`firmware/src/led.c`). Ver [pendencias.md](pendencias.md).

## Como o PC enxerga

- **Joystick HID** "Handbrake HB-1": eixo X de 0 a 4095 e botão 1 (aciona a partir de 50 % do curso).
- **Porta serial** "HB-1 Config": usada só pelo site.
- O número de série USB é o ID único da flash da placa (16 caracteres hexadecimais).
