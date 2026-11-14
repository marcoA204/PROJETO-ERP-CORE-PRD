# MANUAL DE OPERAÇÕES SQL - ERP-CORE (v4.0)

> **Nota sobre a v4.0:** O banco (`ERP_PDV_Master`) agora possui travas nativas de integridade (impede estoque negativo, preços negativos, dois caixas abertos ao mesmo tempo e vendas sem saldo). Além disso, operações críticas que antes eram feitas com `INSERT`/`UPDATE` manuais agora possuem **Procedures** dedicadas e registro automático de falhas na tabela `Log_Erros`.

---

## ⚙️ 1. Procedures (Ações Automatizadas)

São os comandos que executam regras de negócio completas dentro de transações seguras. Se qualquer validação falhar, o banco desfaz tudo automaticamente e registra o motivo em `Log_Erros`.

### 1. Cadastrar um Produto (cria categoria e marca automaticamente)
Se `@codigo_barras` não for informado (`NULL`), o banco gera automaticamente um código interno de 13 dígitos (`200` + ID). Se `@estoque_inicial > 0`, já registra a entrada inicial no histórico.

```sql
EXEC dbo.sp_SalvarProduto 
    @nome = 'CIMENTO CP II 50KG', 
    @preco_custo = 22.00, 
    @preco_venda = 30.00, 
    @estoque_inicial = 100, 
    @estoque_minimo = 20, 
    @codigo_barras = '7891234567890', -- Opcional (NULL gera código interno)
    @nome_categoria = 'Básico', 
    @nome_marca = 'Votorantim';
```

### 2. Abrir o Caixa (Início do Turno)
Substitui o `INSERT` manual. Garante que apenas **um** caixa fique aberto por vez e devolve o `id_caixa` gerado.

```sql
EXEC dbo.sp_AbrirCaixa 
    @troco_inicial = 100.00;
```

### 3. Fechar o Caixa (Fim do Turno)
Substitui o `UPDATE` manual. Encerra o turno com a data/hora atual e já retorna na tela o resumo financeiro do fechamento.

```sql
EXEC dbo.sp_FecharCaixa 
    @id_caixa = 1; -- Substituir pelo ID do caixa aberto
```

### 4. Dar Entrada no Estoque (Compra / Reposição)
Soma a quantidade ao saldo atual do produto e grava a movimentação com o saldo resultante na auditoria.

```sql
EXEC dbo.sp_EntradaEstoque 
    @id_produto = 1, 
    @quantidade = 50, 
    @motivo = 'Compra fornecedor NF 1234';
```

### 5. Registrar Venda Completa (Fluxo Principal Recomendado)
Processa a venda inteira (cabeçalho, itens, baixa de estoque com trava contra venda simultânea e pagamentos) em **uma única chamada**. Os preços de venda e custo são buscados diretamente do banco.

* **Formas de pagamento aceitas:** `'DINHEIRO'`, `'PIX'`, `'CARTAO_DEBITO'`, `'CARTAO_CREDITO'`, `'BOLETO'`, `'OUTROS'`.
* **Regra:** A soma de `valor_pago` no JSON deve ser exatamente igual ao total dos itens menos `@valor_desconto`.

```sql
DECLARE @id_nova_venda INT;

EXEC dbo.sp_RegistrarVenda
    @id_caixa        = 1,
    @valor_desconto  = 5.00,
    @itens_json      = N'[
        {"codigo_barras": "7891234567890", "quantidade": 2},
        {"codigo_barras": "2000000000002", "quantidade": 1}
    ]',
    @pagamentos_json = N'[
        {"forma_pagamento": "PIX", "valor_pago": 50.00},
        {"forma_pagamento": "DINHEIRO", "valor_pago": 25.00}
    ]',
    @id_venda        = @id_nova_venda OUTPUT;
```

### 6. Registrar Item Avulso na Venda (Fluxo Legado / Compatibilidade)
Mantido apenas para compatibilidade com integrações antigas que criam a venda antes de inserir os itens um a um. Para novas chamadas, prefira `sp_RegistrarVenda`.

```sql
EXEC dbo.sp_RegistrarItemVenda 
    @id_venda = 1, 
    @codigo_barras = '7891234567890', 
    @quantidade = 5;
```

---

## 📊 2. Views (Relatórios e Dashboards)

Consultas prontas para leitura no sistema ou análise rápida. Na v4.0, os relatórios financeiros ignoram automaticamente vendas com status `'CANCELADA'`.

### 1. Ver o Catálogo de Produtos Ativos
```sql
SELECT * FROM dbo.vw_CatalogoProdutos;
```

### 2. Ver Sugestão de Compra (Alerta de Estoque Mínimo)
Lista produtos ativos com `estoque_atual <= estoque_minimo` e calcula quanto comprar.
```sql
SELECT * FROM dbo.vw_SugestaoCompra;
```

### 3. Conferir a Gaveta do Caixa (Resumo por Turno)
Mostra o troco inicial, o faturamento total (somente vendas concluídas) e o valor físico esperado em dinheiro na gaveta.
```sql
SELECT * FROM dbo.vw_FechamentoCaixa;
```

### 4. Ver a DRE (Lucro Líquido Mensal)
Cruza faturamento líquido, custo dos produtos vendidos (CMV) e despesas pagas. Meses que tiveram apenas despesas (sem vendas) também aparecem no relatório.
```sql
SELECT * FROM dbo.vw_RelatorioMensal_DRE;
```

### 5. Ver Últimos Erros do Banco (Diagnóstico)
Exibe os últimos 100 erros capturados pelas procedures, incluindo a mensagem e os parâmetros recebidos na chamada.
```sql
SELECT * FROM dbo.vw_ErrosRecentes;
```

---

## 🛒 3. Comandos Avulsos (O Fluxo do Dia a Dia)

Comandos diretos para operações administrativas, financeiro e auditoria.

### A. Gestão de Vendas (Cancelamento)
Como vendas concluídas entram no fechamento de caixa e na DRE, caso precise invalidar uma venda, altere o status para `'CANCELADA'`:

```sql
UPDATE dbo.Vendas 
SET status_venda = 'CANCELADA' 
WHERE id_venda = 15; -- Substituir pelo ID da venda
```

> **Atenção:** Se a venda cancelada já havia baixado estoque, lembre-se de devolver os itens ao saldo usando `EXEC dbo.sp_EntradaEstoque` com o motivo `'Estorno venda ID: 15'`.

### B. Financeiro (Contas a Pagar)
O banco exige consistência entre status e data: contas `'PENDENTE'` devem ter `data_pagamento = NULL`, e contas `'PAGO'` exigem uma data preenchida.

**1. Lançar uma conta a vencer:**
```sql
INSERT INTO dbo.Despesas (descricao, data_vencimento, valor_total, status_pagamento, data_pagamento)
VALUES ('Boleto Fornecedor Tigre', '2026-11-20', 1500.00, 'PENDENTE', NULL);
```

**2. Dar baixa em uma conta paga:**
```sql
UPDATE dbo.Despesas 
SET status_pagamento = 'PAGO', data_pagamento = CAST(SYSDATETIME() AS DATE) 
WHERE id_despesa = 5;
```

### C. Auditoria e Diagnóstico Rápido

**1. Rastrear movimentações de um produto (com saldo resultante após cada operação):**
```sql
SELECT data_movimento, tipo_movimento, quantidade, estoque_resultante, motivo, usuario_responsavel 
FROM dbo.Historico_Movimentacao_Estoque 
WHERE id_produto = 10 -- Coloque o ID do produto
ORDER BY data_movimento DESC;
```

**2. Painel de Resumo do Dia:**
```sql
SELECT 'Vendas Concluidas Hoje' AS Indicador, COUNT(*) AS Total 
FROM dbo.Vendas 
WHERE status_venda = 'CONCLUIDA' AND CAST(data_venda AS DATE) = CAST(SYSDATETIME() AS DATE)
UNION ALL
SELECT 'Turnos Hoje', COUNT(*) 
FROM dbo.Controle_Caixa 
WHERE CAST(data_abertura AS DATE) = CAST(SYSDATETIME() AS DATE)
UNION ALL
SELECT 'Produtos Ativos', COUNT(*) 
FROM dbo.Produtos 
WHERE ativo = 1;
```

---

## 🛡️ 4. Referência Rápida de Erros (`THROW` / `Log_Erros`)

Quando uma regra de negócio é violada, as procedures retornam um código fixo para a aplicação (Node.js) e gravam o detalhe em `dbo.Log_Erros`:

| Faixa de Código | Procedure | Exemplos de Validação |
| :--- | :--- | :--- |
| **50020 – 50024** | `sp_SalvarProduto` | Nome vazio, preços/estoque negativos ou código de barras duplicado em produto ativo. |
| **50030 – 50033** | `sp_RegistrarItemVenda` | Quantidade inválida, venda inexistente, produto inativo ou estoque insuficiente. |
| **50040 – 50043** | `sp_AbrirCaixa` / `sp_FecharCaixa` | Troco negativo, tentativa de abrir caixa já havendo outro aberto, caixa inexistente ou já fechado. |
| **50050 – 50051** | `sp_EntradaEstoque` | Quantidade menor/igual a zero ou produto inexistente/inativo. |
| **50060 – 50069** | `sp_RegistrarVenda` | JSON inválido, caixa fechado, item sem estoque, desconto maior que o total ou soma dos pagamentos diferente do valor a receber. |