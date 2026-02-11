# Integração com Bling API v3

## Visão Geral

A API do Bling permite importar produtos do ERP Bling para o catálogo B2B. A API v3 usa OAuth 2.0 para autenticação.

## Configuração Necessária

### 1. Criar Aplicativo no Bling

1. Acesse https://developer.bling.com.br/aplicativos
2. Crie um novo aplicativo OAuth
3. Obtenha:
   - `client_id`
   - `client_secret`
4. Configure a URL de callback para receber o código de autorização

### 2. Credenciais Necessárias

```env
BLING_CLIENT_ID=seu_client_id
BLING_CLIENT_SECRET=seu_client_secret
BLING_ACCESS_TOKEN=token_de_acesso
BLING_REFRESH_TOKEN=token_de_refresh
```

## Endpoints Principais

### Base URL

```
https://api.bling.com.br/Api/v3
```

### Listar Produtos

```
GET /produtos
```

**Parâmetros de Query:**
| Parâmetro | Tipo | Descrição | Padrão |
|-----------|------|-----------|--------|
| `pagina` | integer | Número da página | 1 |
| `limite` | integer | Registros por página (max 100) | 100 |
| `criterio` | integer | Critérios de listagem | 1 |
| `tipo` | string | Tipo: P=Produto, S=Serviço, T=Todos | T |
| `codigo` | string | SKUs separados por vírgula | - |

**Resposta:**

```json
{
  "data": [
    {
      "id": 12345,
      "nome": "Produto Exemplo",
      "codigo": "SKU-001",
      "preco": 99.9,
      "precoCusto": 50.0,
      "tipo": "P",
      "situacao": "A",
      "formato": "S",
      "descricaoCurta": "Descrição curta",
      "unidade": "UN",
      "pesoLiquido": 0.5,
      "pesoBruto": 0.6,
      "largura": 10,
      "altura": 5,
      "profundidade": 15,
      "volumes": 1,
      "itensPorCaixa": 1,
      "gtin": "7891234567890",
      "gtinEmbalagem": "",
      "tipoProducao": "P",
      "condicao": 0,
      "freteGratis": false,
      "marca": "Marca X",
      "dataValidade": null,
      "observacoes": "",
      "categoria": {
        "id": 123,
        "descricao": "Categoria"
      },
      "estoque": {
        "minimo": 5,
        "maximo": 100,
        "saldoVirtual": 50
      },
      "midia": {
        "video": {
          "url": ""
        },
        "imagens": {
          "externas": [
            {
              "link": "https://exemplo.com/imagem.jpg"
            }
          ]
        }
      }
    }
  ]
}
```

### Obter Produto por ID

```
GET /produtos/{idProduto}
```

### Categorias de Produtos

```
GET /categorias/produtos
```

### Estoques

```
GET /estoques
GET /estoques/saldos
```

## Autenticação OAuth 2.0

### Fluxo de Autorização

1. **Redirecionar usuário para autorização:**

```
https://www.bling.com.br/Api/v3/oauth/authorize?response_type=code&client_id={CLIENT_ID}&redirect_uri={REDIRECT_URI}&state={STATE}
```

2. **Trocar código por tokens:**

```bash
POST https://www.bling.com.br/Api/v3/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code={CODE}&redirect_uri={REDIRECT_URI}
Authorization: Basic base64(client_id:client_secret)
```

3. **Refresh Token (quando o access_token expirar):**

```bash
POST https://www.bling.com.br/Api/v3/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token&refresh_token={REFRESH_TOKEN}
Authorization: Basic base64(client_id:client_secret)
```

### Headers de Requisição

```
Authorization: Bearer {access_token}
Content-Type: application/json
Accept: application/json
```

## Mapeamento Bling -> Catálogo B2B

| Campo Bling                      | Campo Catálogo | Notas                             |
| -------------------------------- | -------------- | --------------------------------- |
| `id`                             | -              | Armazenar como referência externa |
| `nome`                           | `name`         | Nome do produto                   |
| `codigo`                         | `sku`          | Código/SKU do produto             |
| `preco`                          | `price`        | Preço de venda                    |
| `descricaoCurta`                 | `description`  | Descrição do produto              |
| `marca`                          | `brand`        | Marca do produto                  |
| `categoria.descricao`            | `categoryId`   | Buscar/criar categoria            |
| `estoque.saldoVirtual`           | `stock`        | Quantidade em estoque             |
| `midia.imagens.externas[0].link` | `image`        | URL da imagem                     |
| `situacao`                       | `active`       | A=Ativo, I=Inativo                |
| `gtin`                           | -              | Código de barras (opcional)       |

## Implementação Sugerida

### Estrutura de Arquivos

```
server/
  services/
    bling/
      auth.ts      # Autenticação OAuth
      products.ts  # Sincronização de produtos
      categories.ts # Sincronização de categorias
  routes/
    bling.ts       # Endpoints da integração
```

### Endpoints da Aplicação (detalhado)

A integração é multi-tenant: cada empresa pode salvar credenciais próprias e autorizar o Bling separadamente. O fluxo usa uma tabela de sessão OAuth (`bling_oauth_sessions`) para mapear o parâmetro `state` para a `companyId` e persiste `bling_tokens` com `companyId` (tokens criptografados).

Principais endpoints (company-scoped quando autenticado):

- POST /api/bling/credentials
  - Salva `clientId` / `clientSecret` opcionalmente por empresa (guarda em `bling_credentials`).
  - Uso: { clientId, clientSecret, redirectUri? }
  - Resposta: { success: true }

- GET /api/bling/credentials
  - Retorna se a empresa tem credenciais salvas (clientId parcialmente mascarado) e `redirectUri` quando disponível.

- POST /api/bling/test-credentials
  - Recebe `clientId`/`clientSecret` temporariamente (ou usa credenciais salvas) e retorna a URL de autorização para iniciar o OAuth:
    - Resposta: { ok: true, authUrl }

- GET /api/bling/auth
  - Redireciona o usuário para o endpoint de autorização do Bling. Internamente cria uma sessão (`state`) mapeada para `companyId` para resolver o callback.

- GET /api/bling/callback?code={code}&state={state}
  - Callback OAuth: resolve `companyId` a partir do `state`, troca `code` por tokens e salva tokens criptografados em `bling_tokens` associados à `companyId`.

- POST /api/bling/disconnect
  - Remove tokens (desconecta o Bling) para a empresa autenticada.

- POST /api/bling/sync/categories
  - Inicia sync de categorias em background para a `companyId` do usuário; retorna { started: true } imediatamente.

- POST /api/bling/sync/products
  - Inicia sync de produtos em background para a `companyId` do usuário; retorna { started: true }.

- GET /api/bling/sync/progress
  - SSE (Server-Sent Events) que envia o snapshot atual e atualizações de progresso da sincronização (status, fase, created/updated/errors, estimatedRemaining).

- GET /api/bling/categories/preview
  - Retorna lista leve de categorias no Bling (respeita credenciais da empresa).

- GET /api/bling/products/preview?page={n}
  - Retorna página de produtos do Bling (respeita credenciais da empresa).

- POST /api/bling/categories/import
  - Recebe { categoryIds: number[] } e importa categorias selecionadas para o catálogo da empresa.

- POST /api/bling/products/import
  - Recebe { productIds: number[] } e importa produtos selecionados para a empresa solicitante (garante `companyId` no registro criado).

- POST /api/bling/webhook
  - Receiver top-level para webhooks do Bling. Verifica assinatura HMAC-SHA256 (cabeçalhos `X-Bling-Signature-256` / `X-Bling-Signature` aceitos), valida com `clientSecret` e processa eventos (`product.created|updated|deleted`, `stock.created|updated`).

Observações técnicas:

- Tokens são salvos criptografados e associados a `companyId`; existe lógica para refresh por empresa (`refreshAccessTokenForCompany`) e para obter token válido (`getValidAccessToken(companyId)`).
- Todos os requests para a API do Bling usam `blingApiRequest(endpoint, companyId?)` que tenta refresh quando recebe 401.
- Syncs repectam rate limits, usam retries com backoff e controle de concorrência; progresso é publicado via SSE.
- As migrations importantes: `0006_bling_oauth_sessions.sql` (mapeia state -> company_id) e a tabela de tokens (`bling_tokens`) devem estar aplicadas antes de usar OAuth multi-empresa.

## Tratamento de Erros

### Códigos HTTP

- `401` - Token expirado (fazer refresh)
- `429` - Rate limit (aguardar e tentar novamente)
- `500` - Erro interno do Bling

### Rate Limiting

A API do Bling tem limite de requisições. Implementar:

- Delay entre requisições (100ms)
- Retry com backoff exponencial
- Cache de dados frequentes

## Sincronização

### Estratégia Recomendada

1. **Sincronização Inicial:**
   - Paginar todos os produtos
   - Criar categorias não existentes
   - Inserir produtos em lote

2. **Sincronização Incremental:**
   - Usar webhooks do Bling (se disponível)
   - Ou sync periódico a cada X horas
   - Atualizar apenas produtos modificados

3. **Mapeamento de IDs:**
   - Manter tabela de referência `blingId` -> `productId`
   - Permitir atualização sem duplicar produtos

## Webhooks (Sincronização Automática)

Os webhooks do Bling permitem receber notificações em tempo real quando produtos são criados, atualizados ou excluídos no ERP.

### Configuração no Bling

1. Acesse seu aplicativo em https://developer.bling.com.br/aplicativos
2. Navegue até a aba "Webhooks"
3. Configure o servidor de destino (URL do webhook)
4. Selecione os recursos que deseja receber notificações:
   - `product.created` - Produto criado
   - `product.updated` - Produto atualizado
   - `product.deleted` - Produto excluído
   - `stock.created` - Estoque atualizado
   - `stock.updated` - Estoque atualizado

### URL do Webhook

```
https://seu-dominio.replit.dev/api/bling/webhook
```

### Verificação de Assinatura

O Bling envia uma assinatura HMAC-SHA256 no header `X-Bling-Signature-256` para validar a autenticidade da requisição.

```typescript
import crypto from "crypto";

function verifyWebhookSignature(payload: string, signature: string): boolean {
  const clientSecret = process.env.BLING_CLIENT_SECRET;

  const expectedSignature = crypto
    .createHmac("sha256", clientSecret)
    .update(payload, "utf8")
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(signature, "hex"),
  );
}
```

### Estrutura do Payload

```json
{
  "eventId": "uuid-do-evento",
  "date": "2024-01-15T10:30:00Z",
  "version": "3",
  "event": "product.created",
  "companyId": "12345",
  "data": {
    "id": 67890,
    "nome": "Novo Produto",
    "codigo": "SKU-001",
    "preco": 99.9,
    "situacao": "A"
  }
}
```

### Boas Práticas

1. **Responder rapidamente:** Retorne HTTP 2xx imediatamente e processe o webhook de forma assíncrona
2. **Idempotência:** O mesmo webhook pode ser enviado mais de uma vez
3. **Ordem dos eventos:** Eventos podem chegar fora de ordem (ex: update antes de create)
4. **Retries:** O Bling tenta reenviar por até 3 dias com intervalos crescentes
5. **Desativação automática:** Se todas as tentativas falharem, o webhook é desativado

### Eventos Suportados na Aplicação

| Evento            | Ação                        |
| ----------------- | --------------------------- |
| `product.created` | Cria produto no catálogo    |
| `product.updated` | Atualiza produto existente  |
| `product.deleted` | Remove produto do catálogo  |
| `stock.created`   | Atualiza estoque do produto |
| `stock.updated`   | Atualiza estoque do produto |

## Links Úteis

- [Documentação Oficial](https://developer.bling.com.br/)
- [Documentação de Webhooks](https://developer.bling.com.br/webhooks)
- [Referência da API](https://developer.bling.com.br/referencia)
- [SDK JavaScript](https://github.com/AlexandreBellas/bling-erp-api-js)
- [OpenAPI Spec](https://developer.bling.com.br/build/assets/openapi-CilBfHrw.json)
