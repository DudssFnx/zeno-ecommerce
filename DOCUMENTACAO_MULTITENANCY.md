# Documentação de Multi Tenancy – Zeno Ecommerce

## Visão Geral

O sistema utiliza o modelo de multi tenancy por coluna, garantindo que todos os dados sensíveis de cada empresa fiquem isolados por meio do campo `companyId` em todas as tabelas relevantes. Cada registro criado no sistema é sempre associado à empresa do usuário logado, impedindo o vazamento ou mistura de dados entre empresas.

---

## Estrutura de Dados

### Tabelas com Suporte a Multi Tenancy

As principais tabelas do banco de dados possuem o campo `companyId`:

- users
- products
- orders
- categories
- suppliers
- payment_terms
- receivables
- receivable_payments
- payables
- payable_payments
- order_item_discounts
- purchase_orders
- purchase_order_items
- bling_credentials
- bling_tokens

**Observação:** Novas tabelas que armazenem dados sensíveis de empresa devem obrigatoriamente conter o campo `companyId`.

---

## Regras de Isolamento

1. **Criação de Registros**
   - Sempre que um novo registro for criado (usuário, produto, pedido, etc.), o campo `companyId` deve ser preenchido com o id da empresa do usuário logado.
   - O backend exige que o `companyId` seja passado explicitamente em todos os métodos de criação.

2. **Consultas e Listagens**
   - Todas as queries e endpoints devem filtrar os dados usando `WHERE companyId = :companyId`.
   - Nunca retorne dados sem filtrar por empresa.

3. **Atualizações e Exclusões**
   - Operações de update/delete também devem ser restritas ao escopo da empresa do usuário logado.

4. **Relacionamentos**
   - Relacionamentos entre entidades (ex: pedidos e itens, produtos e categorias) devem sempre respeitar o mesmo `companyId`.

5. **Validação de Dados**
   - Não é permitido criar registros com `companyId` nulo ou vazio.
   - Não é permitido alterar o `companyId` de um registro já existente para o de outra empresa.

---

## Fluxo de Criação de Dados

1. O usuário faz login e seu `companyId` é carregado na sessão/contexto.
2. Ao criar qualquer registro, o frontend/backend envia o `companyId` junto com os dados.
3. O backend insere o registro no banco, associando ao `companyId` informado.

---

## Exemplo de Criação de Produto

```typescript
await storage.createProduct({
  nome: "Produto Teste",
  sku: "SKU-123",
  precoVarejo: 100,
  companyId: usuarioLogado.companyId, // sempre obrigatório
  // ...outros campos
});
```

---

## Segurança

- O sistema impede que um usuário acesse, edite ou exclua dados de outra empresa.
- Todas as rotas e serviços devem validar o `companyId` do usuário logado antes de qualquer operação.
- Testes automatizados garantem que não há vazamento de dados entre empresas.

---

## Checklist de Multi Tenancy

- [x] Todas as tabelas sensíveis possuem o campo `companyId`.
- [x] Todos os métodos de criação exigem o `companyId`.
- [x] Todas as queries filtram por `companyId`.
- [x] Não há registros com `companyId` nulo.
- [x] Não é possível acessar dados de outra empresa.

---

## Observações Finais

- O modelo atual permite, no futuro, separar dados por empresa facilmente, bastando filtrar pelo `companyId`.
- Para migração de dados ou integração, sempre respeite o campo `companyId`.
- Em caso de dúvidas, consulte esta documentação ou a equipe de desenvolvimento.
