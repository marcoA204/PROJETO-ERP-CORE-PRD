# Analytics — ERP-CORE

Camada de **análise de dados** do ERP-CORE. Tudo aqui é somente leitura: lê o que o sistema
operacional já registra (vendas, itens, histórico de estoque) e transforma em indicadores de decisão.

## Como instalar

1. `database/ERP_CORE_etapa3_v4.3.sql` (taxas e DRE líquida)
2. `analytics/01_funcoes_analiticas.sql` (este script)

No sistema, os resultados aparecem no menu **Análises**.

## Indicadores

### 1. Curva ABC por lucro — `fn_CurvaABC(@dias)`
Responde: **quais produtos realmente pagam as contas?**

- Ordena os produtos do maior para o menor lucro (receita − custo da época da venda).
- Calcula o % de cada um e o **% acumulado**.
- Classe **A**: juntos explicam os primeiros 80% do lucro. **B**: de 80% a 95%. **C**: o restante.
- Colunas: `qtd_vendida`, `receita`, `custo`, `lucro`, `margem_pct`, `pct_lucro`, `pct_acumulado`, `classe`.

Como ler: um produto de **muito volume e classe C** vende bastante mas deixa pouco lucro (margem baixa).
Um produto de **pouco volume e classe A** é pouco vendido, mas muito lucrativo (vale destacar no balcão).

### 2. Estoque parado — `fn_EstoqueParado(@dias)`
Responde: **quanto dinheiro está dormindo na prateleira?**

- Produtos com saldo e **sem nenhuma saída** (venda ou uso como ingrediente) nos últimos `@dias`.
- `capital_parado = estoque_atual × preco_custo`.
- Produto recém-cadastrado só é considerado parado depois de `@dias` desde o cadastro.
- Produtos com ficha técnica ficam de fora (não têm estoque próprio).

### 3. Dias e horários de pico — `fn_PicoVendas(@dias)`
Responde: **quando a loja mais vende?** (para escalar equipe, repor antes e planejar promoções)

- Agrupa vendas concluídas por **dia da semana × hora**: `qtd_vendas` e `faturamento`.
- `dia_semana_num`: 0 = segunda … 6 = domingo (independe do idioma do SQL Server).

## Regras comuns

- Vendas **canceladas** nunca entram em nenhum indicador.
- A janela de tempo é um parâmetro (`@dias`): 30, 90, 365…
- Os valores vêm dos **registros congelados na venda** (preço e custo da época), então mudar o preço depois
  não reescreve a história.

## Conciliação de taxas (resumo)

As taxas da maquininha ficam em `TaxasPagamento` e são **gravadas em cada pagamento** na hora da venda.
Por isso `vw_FechamentoCaixa`, `vw_ConciliacaoCaixa` e `vw_RelatorioMensal_DRE` mostram o lucro líquido real
(já descontando taxas) e mudar a taxa hoje não altera vendas antigas.