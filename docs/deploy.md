# Deploy no Cloudflare

O site é estático: a pasta `web/` vai inteira para o **Cloudflare Pages**, que publica sozinho a cada push na `main`. O `/admin` fica protegido pelo **Cloudflare Access** (login com código por e-mail), sem senha no código.

## Configuração atual (produção)

| Item | Valor |
|---|---|
| Conta Cloudflare | AndreiJoda |
| Projeto Pages | `layerbros-hb1`: branch `main`, preset *None*, build vazio, saída `web` |
| Endereços | https://hb1.layerbros.com (zona `layerbros.com` na mesma conta) e https://layerbros-hb1.pages.dev |
| Equipe Zero Trust | `joda` (`joda.cloudflareaccess.com`), plano Free (até 50 usuários) |
| Login | One-time PIN (código por e-mail) |
| Política reutilizável **HB-1 Operadores** | Allow por e-mail, sessão de 24 h |
| App Access **HB-1 Produção** | `/admin` e `/admin/*` em `hb1.layerbros.com` e em `layerbros-hb1.pages.dev` |
| App Access **HB-1 Prévias do Pages** | `*.layerbros-hb1.pages.dev` inteiro (a URL própria de cada deploy) |

Ficam públicos, de propósito: `/`, `/recalibrar/`, `/assets/*` e `/firmware/*`. Nenhum desses arquivos tem segredo; a proteção do `/admin` está no Access, não no código.

Conferido sem login (2026-11-05):

| Endereço | Resposta |
|---|---|
| `/` e `/recalibrar/` nos dois domínios | 200 |
| `/admin`, `/admin/`, `/admin/index.html` nos dois domínios | 302 para `joda.cloudflareaccess.com` |
| `https://<hash>.layerbros-hb1.pages.dev/` | 302 para o login |

Para repetir a conferência:

```bash
for h in hb1.layerbros.com layerbros-hb1.pages.dev; do for p in / /recalibrar/ /admin/; do echo "$h$p $(curl -s -o /dev/null -w '%{http_code}' https://$h$p)"; done; done
```

Esperado: 200, 200 e 302 em cada domínio.

## Tarefas do dia a dia

**Publicar uma mudança:** push na `main`. O deploy leva cerca de um minuto. Pull requests ganham URL de prévia, protegida pelo Access.

**Liberar um operador:**
1. Zero Trust → **Access controls → Policies → HB-1 Operadores**.
2. Em *Include → Emails*, adicione o e-mail.

Vale para a produção e para as prévias.

**Tirar um operador:** remova o e-mail da mesma política. Para derrubar sessões abertas na hora, use Zero Trust → **My Team → Users → Revoke**.

**Publicar firmware novo:** ver [firmware.md](firmware.md#publicar-uma-versão-nova). O commit de `web/firmware/` dispara o deploy, e a produção passa a gravar a versão nova.

## Recriar do zero

### 1. Cloudflare Pages

1. **Workers & Pages → Create**. O painel abre no fluxo de *Worker*: procure a opção **Pages** e depois **Connect to Git**.
2. Repositório `andreijoda/layerbros-hb1`.
3. Configuração:
   - Nome do projeto: `layerbros-hb1`
   - Ramificação de produção: `main`
   - Predefinição da estrutura: **Nenhum**
   - Comando da build: *(vazio)*
   - Diretório de saída: **`web`**
4. **Salvar e implantar.**
5. Domínio próprio: projeto → **Custom domains → Set up a custom domain** → `hb1.layerbros.com`.

O log do deploy pode avisar que o `wrangler.jsonc` não tem `pages_build_output_dir` e será ignorado. É esperado: esse arquivo serve só à alternativa abaixo.

O `web/_headers` é aplicado automaticamente (CSP, permissões de USB/serial, `noindex` no admin).

#### Alternativa: Worker com arquivos estáticos

Se preferir o fluxo de *Worker*, o `wrangler.jsonc` publica `web/` como arquivos estáticos (o `_headers` continua valendo):

- Comando da build: *(vazio)*
- Comando de implantação: `npx wrangler deploy`

Nesse caso, proteja o `/admin` num **domínio próprio** e desative o endereço `workers.dev` (Worker → Settings → Domains & Routes). Assim o `/admin` não fica acessível por ele.

### 2. Cloudflare Access

1. **Zero Trust**: crie a equipe e escolha o plano Free. Pode pedir cartão mesmo no plano gratuito.
2. **Integrations → Identity providers**: confira se há **One-time PIN**.
3. **Access controls → Policies → Add a policy**:
   - Nome **HB-1 Operadores**, Action **Allow**
   - Include → **Emails** → os operadores
   - Sessão de 24 h
4. **Access controls → Applications → Add an application → Self-hosted**:
   - Nome **HB-1 Produção**
   - Public hostnames: `hb1.layerbros.com` com path `admin` e com path `admin/*`, e o mesmo para `layerbros-hb1.pages.dev`
   - Política **HB-1 Operadores**; login **One-time PIN**
5. Repita para **HB-1 Prévias do Pages**, com o hostname `*.layerbros-hb1.pages.dev` (sem path).
6. Teste numa janela anônima, ou com o `curl` acima.

### Pela API

A mesma configuração foi criada pela API da Cloudflare:
- `POST /accounts/{id}/access/policies`;
- `POST /accounts/{id}/access/apps` com `type: self_hosted`, `destinations` do tipo `public` e a política referenciada por `id`.

Útil para automatizar ou recriar em outra conta.

## Identidade do operador

A tela de produção lê `/cdn-cgi/access/get-identity` e mostra o e-mail de quem entrou. O e-mail também vai no CSV. Fora do Access (ex.: `localhost`), aparece "local (sem Cloudflare Access)".

## Checklist de deploy

- [ ] `npm run check`, `npm test` e `node tools/e2e.mjs` passando
- [ ] CI verde no GitHub
- [ ] `curl` acima: 200, 200 e 302 nos dois domínios
- [ ] `/firmware/manifest.json` na versão certa
- [ ] Teste real: gravar, calibrar e registrar uma placa; recalibrar pela tela do cliente
