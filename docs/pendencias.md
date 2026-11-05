# Pendências

O que falta antes de vender em escala. Marque ao resolver.

## Obrigatório

- [ ] **Teste com hardware real.** O firmware compila e o site foi testado de ponta a ponta com um HB-1 simulado. Precisam ser confirmados numa placa de verdade: a gravação por WebUSB (no Windows, com WinUSB via Zadig), a leitura do 49E, o LED e o joystick nos jogos.
- [ ] **Login completo do `/admin`.** O bloqueio sem login foi conferido; falta entrar uma vez com o código por e-mail e confirmar que aparece "Operador: <seu e-mail>" no cabeçalho.
- [ ] **PID USB próprio.** O PID `0x10C8` com o VID da Raspberry Pi (`0x2E8A`) é provisório. Peça um PID gratuito em https://github.com/raspberrypi/usb-pid (projeto com RP2040) e atualize `firmware/src/config.h`, `web/assets/js/hb1.js` e `tools/fake-hb1.js`.
- [ ] **Contato de suporte** no rodapé de `web/index.html` (`[CONTATO DE SUPORTE]`).
- [x] **Cloudflare Access** configurado e testado em `hb1.layerbros.com`, no `pages.dev` e nas prévias ([deploy.md](deploy.md)).

## Verificar na primeira placa

- [ ] Ordem de cor do LED WS2812 (RGB × GRB) em `firmware/src/led.c`.
- [ ] Sentido e intensidade do ímã: repouso e puxado com pelo menos 2000 pontos de diferença, de preferência.
- [ ] Ruído com a alavanca parada ≤ ±6.
- [ ] Jogos-alvo reconhecem o eixo X (Assetto Corsa, ACC, BeamNG, DiRT Rally, F1, Forza no PC). Se algum exigir outro eixo (ex.: Z ou slider), trocar o Usage em `usb_descriptors.c`.
- [ ] Limiar do botão (50 %) faz sentido para quem usa o freio como botão.

## Ideias para depois

- Ajustes avançados para o cliente: zona morta, curva de resposta, modo botão com limiar ajustável (protocolo e `hb1_config_t` precisam de versão nova).
- Atualização de firmware pela página do cliente (exige WinUSB no Windows; avaliar com MS OS descriptors).
- Registro de produção central (ex.: Cloudflare D1) em vez do CSV local.
