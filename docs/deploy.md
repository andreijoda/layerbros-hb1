# Deploy no Cloudflare

O site é estático: a pasta `web/` vai inteira para o **Cloudflare Pages**. O `/admin` fica protegido pelo **Cloudflare Access** (login por e-mail com código ou por provedor), sem senha no código.

## 1. Cloudflare Pages

1. Painel Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Escolha o repositório `andreijoda/layerbros-hb1`.
3. Configuração do build:
   - Framework preset: **None**
   - Build command: *(vazio)*
   - Build output directory: **`web`**
4. Salve. Cada push na `main` publica sozinho. Pull requests ganham URL de prévia.
5. (Opcional) **Custom domains** → adicione o domínio, ex. `hb1.layerbros.com.br`.

O arquivo `web/_headers` é aplicado automaticamente (CSP, permissões de USB/serial, `noindex` no admin).

## 2. Proteger o `/admin` com Cloudflare Access

1. Painel Cloudflare → **Zero Trust** (o plano Free atende até 50 usuários).
2. Na primeira vez, escolha um nome de equipe (ex. `layerbros`).
3. **Settings → Authentication → Login methods**: deixe **One-time PIN** (código por e-mail) ou adicione Google.
4. **Access → Applications → Add an application → Self-hosted**:
   - Nome: `HB-1 Produção`
   - Session duration: 24 h
   - Domínios protegidos (adicione os dois):
     - `<seu-domínio>/admin`
     - `<seu-domínio>/admin/*`
   - Se usar o domínio do Pages (`*.pages.dev`), proteja também `<projeto>.pages.dev/admin*`.
5. **Policies → Add a policy**:
   - Nome: `Operadores`
   - Action: **Allow**
   - Include → **Emails** → os e-mails de quem opera a produção.
6. Salve e teste em uma janela anônima: `/admin/` deve pedir login; `/` e `/recalibrar/` não.

### Prévias do Pages

Cada deploy de prévia ganha um subdomínio próprio (`<hash>.<projeto>.pages.dev`). Para não deixar o admin aberto nelas, ative em **Pages → Settings → General → Access policy** a proteção das prévias, ou crie no Access uma aplicação para `*.<projeto>.pages.dev/admin*`.

### Identidade do operador

A página de produção lê `/cdn-cgi/access/get-identity` e mostra o e-mail de quem entrou. O e-mail também vai no CSV. Fora do Access (ex.: `localhost`) aparece "local".

## 3. Atualizar o firmware publicado

1. Gere a versão nova ([firmware.md](firmware.md#publicar-uma-versão-nova)).
2. Commit de `web/firmware/` + push. O Pages publica e a produção passa a gravar a versão nova.

## Checklist de deploy

- [ ] `npm test` e `node tools/e2e.mjs` passando
- [ ] CI verde no GitHub
- [ ] `/admin/` pede login em janela anônima (domínio próprio **e** `pages.dev`)
- [ ] `/firmware/manifest.json` aponta para a versão certa
- [ ] Teste real: gravar, calibrar e registrar uma placa; recalibrar pela página do cliente
