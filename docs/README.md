# Documentação do HB-1

| Documento | Para quem | O que tem |
|---|---|---|
| [hardware.md](hardware.md) | Montagem | Peças, ligação do 49E, ímã, LED de status |
| [firmware.md](firmware.md) | Dev | Compilar, estrutura, da leitura ao joystick, memória, release |
| [protocolo-serial.md](protocolo-serial.md) | Dev | Todos os comandos e respostas entre site e placa |
| [web.md](web.md) | Dev | Telas, módulos JS, navegadores, PICOBOOT, testes, prints |
| [producao.md](producao.md) | Operador | Passo a passo do `/admin`, drivers, problemas comuns |
| [deploy.md](deploy.md) | Dono | Configuração atual da Cloudflare, operadores, como recriar |
| [pendencias.md](pendencias.md) | Dono | O que falta antes de vender em escala |

As imagens em [`img/`](img/) são geradas por `node tools/screenshots.mjs` a partir do site real com o HB-1 simulado. Mudou o visual de uma tela? Rode de novo e faça commit das imagens.
