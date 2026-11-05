# Produção: passo a passo do operador

Endereço: **https://hb1.layerbros.com/admin/**. Use o **Chrome** ou o **Edge** no computador.

- **Login:** digite seu e-mail e o código que chega nele. Vale por 24 h. Seu e-mail precisa estar liberado ([deploy.md](deploy.md#tarefas-do-dia-a-dia)).
- **Cabeçalho:** mostra seu e-mail, o firmware que será gravado e atalhos para as telas do cliente (**Início** e **Recalibrar**). Use esses atalhos para conferir uma unidade como o cliente vai ver.
- **Favoritos:** as telas do cliente não têm link para a produção. Salve o endereço nos favoritos.

![Tela de produção](img/producao-conectar.png)

## Regras de ouro

1. **Zadig uma vez só, só em "RP2 Boot (Interface 1)"**, com o BOOT segurado. Nunca no "Handbrake HB-1".
2. **Sensor e ímã montados antes de calibrar.** Sem o 49E, o GP26 fica solto e lê ruído (fica em ~20 % e oscila). Calibrar assim grava lixo.
3. **Uma aba do site por vez.** Duas abas disputam a mesma porta COM.

## Os dois modos da placa (e por que existem "interfaces")

A placa aparece no PC como **dois aparelhos USB diferentes**, conforme o modo. Cada um tem suas interfaces, e os números se repetem entre os modos com significados diferentes, por isso confundem.

**Modo BOOT: "RP2 Boot"** (VID `2E8A`, PID `0003`). Placa nova, ou ligada segurando BOOT. Vem gravado no chip e nunca se apaga.

| Interface | O que é | Driver no Windows |
|---|---|---|
| 0 | Pendrive **RPI-RP2** (arrastar `.uf2`) | Nativo |
| 1 | **PICOBOOT**: porta de gravação usada pelo `/admin` | **WinUSB pelo Zadig**, uma vez por PC |

**Modo HB-1: "Handbrake HB-1"** (VID `2E8A`, PID `10C8`). Firmware rodando, o uso normal.

| Interface | O que é | Driver no Windows |
|---|---|---|
| 0 (e 1, de dados) | **"HB-1 Config"**: porta serial (COMx) usada pelo site para ler, calibrar e registrar | Nativo (`usbser`). **Nunca Zadig.** |
| 2 | **"HB-1 Joystick"**: o que os jogos enxergam | Nativo |

No Chrome do Windows o HB-1 aparece como **"HB-1 Config (Interface 0) (COMx)"**.

## Preparar o computador (uma vez)

### Windows: driver da gravação (só para o caminho B)

Se preferir não instalar nada, use o caminho A, que dispensa driver. O Windows não libera a interface de gravação da RP2040 para o navegador sem o driver **WinUSB**. Faça uma vez em cada PC de produção:

1. Baixe o **Zadig** em https://zadig.akeo.ie.
2. Coloque uma placa em modo BOOT (segure BOOT e conecte).
3. No Zadig: *Options → List All Devices*.
4. Escolha **RP2 Boot (Interface 1)**. Atenção: **Interface 1**, não a 0. E nunca aplique o Zadig em **Handbrake HB-1** (placa com firmware): isso tira a porta serial e o site deixa de encontrar o freio (ver "Problemas comuns").
5. Driver de destino **WinUSB**, clique em *Install Driver*.

O pendrive RPI-RP2 continua funcionando. O cliente nunca precisa disso: a recalibração usa só a porta serial.

### Linux: permissão USB

```bash
echo 'SUBSYSTEM=="usb", ATTRS{idVendor}=="2e8a", MODE="0666"' | sudo tee /etc/udev/rules.d/60-rp2040.rules
```

```bash
sudo udevadm control --reload-rules && sudo udevadm trigger
```

### macOS

Nada a fazer.

## Antes de começar o lote

- Confira o firmware no topo da página (ex.: `FIRMWARE HB1-1.0.0.UF2`). Se aparecer "Firmware indisponível", o deploy está incompleto.
- Ajuste **Próximo número de série** na coluna da direita, se for o primeiro lote neste computador.

## Cada unidade

A versão ilustrada deste passo a passo também está no site, em **https://hb1.layerbros.com/admin/guia/** (botão **Guia** no cabeçalho da produção).

O passo 1 da tela tem dois caminhos:

| | A. Arrastar o arquivo (recomendado) | B. Gravar pelo site |
|---|---|---|
| Driver | Nenhum, em nenhum sistema | WinUSB pelo Zadig, uma vez por PC Windows |
| Conferência | O bootloader confere cada bloco | Leitura byte a byte depois de gravar |
| Mesma placa? | Uma placa por vez na bancada | Uma placa por vez na bancada (o site avisa se não conseguir confirmar) |

### Caminho A (padrão)

1. **Modo BOOT:** segure **BOOT**, conecte o cabo e solte. Abre o pendrive **RPI-RP2**.
2. **Firmware:**
   - clique em **Baixar firmware** e arraste o `hb1-….uf2` para o **RPI-RP2**;
   - o pendrive some e o LED começa a piscar laranja.
3. **Conectar:** clique em **Conectar HB-1** e escolha **"HB-1 Config (Interface 0) (COMx)"** (no Mac: "Handbrake HB-1"). Com cada placa nova o navegador sempre pergunta.

### Caminho B

1. Segure **BOOT**, conecte e solte. Clique em **Procurar placa** e escolha **"RP2 Boot"**.
2. Clique em **Gravar firmware**. Grava, confere e reinicia em alguns segundos. Não desconecte o cabo.
3. O HB-1 costuma conectar sozinho. Se for a primeira vez com essa placa, clique em **Conectar HB-1**.

Para regravar uma placa que já tem HB-1: conecte normalmente e clique em **Regravar uma placa HB-1**. Ela reinicia em BOOT sozinha. Na primeira vez com cada placa, o navegador pede um clique em **Selecionar RP2 Boot**.

### Depois (os dois caminhos)

4. **Calibrar:**
   - alavanca solta → **Gravar repouso**;
   - alavanca no batente → **Gravar puxado**;
   - se aparecer "Curso menor que 400", confira o ímã e a distância do sensor;
   - confira o ruído (ideal ±6 ou menos);
   - se aparecer "firmware desatualizado", grave de novo antes de continuar.
5. **Registrar:** confira série, ID, calibração e data e clique em **Gravar e finalizar**. A página relê a placa para confirmar.
6. **Pronto:** desconecte, cole a etiqueta com a série mostrada e clique em **Próxima unidade**.

O LED confirma: verde piscando ao salvar, depois verde fraco.

## Lista da sessão

- Cada unidade finalizada entra na lista (série, ID da placa, mín, máx, hora).
- **Baixar CSV** exporta também firmware, data de fabricação, data/hora e operador. Guarde o CSV do dia: é o seu registro de produção.
- A lista e o contador ficam só neste navegador. Trocar de computador ou limpar dados do navegador zera os dois (as placas não mudam).

## Retrabalho (unidade devolvida)

- Placa que já tem série: o fluxo **mantém a série** e só atualiza firmware e calibração.
- Trocar a série de uma placa exige o comando `SET SERIAL!` por terminal serial ([protocolo-serial.md](protocolo-serial.md)). Evite.

## Problemas comuns

| Sintoma | O que fazer |
|---|---|
| "RP2 Boot" não aparece na lista | Confira se entrou em BOOT (aparece o pendrive RPI-RP2). Troque o cabo (precisa ser de dados). |
| "O navegador não conseguiu acessar a placa em modo BOOT" | Windows sem WinUSB na Interface 1 (veja acima) ou outro programa usando a placa (feche o picotool/Thonny). |
| "A gravação falhou" / "verificação falhou" | Desconecte, entre em BOOT de novo e repita. Persistindo, troque o cabo ou a porta USB (evite hub). |
| Janela do Chrome abre **vazia** com a placa já gravada (LED piscando) | O Zadig foi aplicado no HB-1. Em `chrome://device-log` aparece `mi_00 … driver="WinUSB"`. Correção: Zadig → Options → List All Devices → **Handbrake HB-1 (Interface 0)** → driver **USB Serial (CDC)** → Replace Driver → reconecte. Deve surgir "Dispositivo Serial USB (COMx)" em Portas. |
| HB-1 não conecta depois de gravar | Clique em **Conectar HB-1**. Se não aparecer, desconecte e conecte o cabo. |
| "A placa conectada não é a mesma que foi gravada" | Há outro HB-1 ligado no PC. Deixe só a unidade em produção conectada. |
| Leitura não muda ao puxar | Fio OUT do 49E fora do GP26, sensor sem 3V3, ou ímã longe demais. |
| Ruído alto (±15 ou mais) | Fio do sensor longo ou perto de fonte de ruído. Adicione o capacitor de 100 nF. |
