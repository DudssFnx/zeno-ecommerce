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
      "preco": 99.90,
      "precoCusto": 50.00,
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

| Campo Bling | Campo Catálogo | Notas |
|-------------|----------------|-------|
| `id` | - | Armazenar como referência externa |
| `nome` | `name` | Nome do produto |
| `codigo` | `sku` | Código/SKU do produto |
| `preco` | `price` | Preço de venda |
| `descricaoCurta` | `description` | Descrição do produto |
| `marca` | `brand` | Marca do produto |
| `categoria.descricao` | `categoryId` | Buscar/criar categoria |
| `estoque.saldoVirtual` | `stock` | Quantidade em estoque |
| `midia.imagens.externas[0].link` | `image` | URL da imagem |
| `situacao` | `active` | A=Ativo, I=Inativo |
| `gtin` | - | Código de barras (opcional) |

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

### Endpoints da Aplicação

```typescript
// Iniciar autenticação
GET /api/bling/auth

// Callback OAuth
GET /api/bling/callback?code={code}&state={state}

// Importar produtos
POST /api/bling/sync/products

// Status da integração
GET /api/bling/status
```

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

## Links Úteis

- [Documentação Oficial](https://developer.bling.com.br/)
- [Referência da API](https://developer.bling.com.br/referencia)
- [SDK JavaScript](https://github.com/AlexandreBellas/bling-erp-api-js)
- [OpenAPI Spec](https://developer.bling.com.br/build/assets/openapi-CilBfHrw.json)
