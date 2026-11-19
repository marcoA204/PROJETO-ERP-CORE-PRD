/* ============================================================================
   ERP-CORE  -  ANALYTICS  (v4.3)
   Funcoes analiticas do painel "Analises". Somente LEITURA: nao alteram dados.
   Rode DEPOIS de database/ERP_CORE_etapa3_v4.3.sql. Pode rodar varias vezes.

   Cada funcao recebe a janela de tempo em DIAS, entao a mesma consulta serve
   para "ultimo mes", "ultimo trimestre", etc.:
       SELECT * FROM dbo.fn_CurvaABC(90);
       SELECT * FROM dbo.fn_EstoqueParado(30);
       SELECT * FROM dbo.fn_PicoVendas(90);
   Arquivo ASCII puro (sem acentos) de proposito. Explicacao completa: README.md
   ============================================================================ */

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE ERP_PDV_Master;
GO

-- 1. CURVA ABC por LUCRO -------------------------------------------------------
--    Ordena os produtos do que mais da lucro para o que menos da e soma o percentual acumulado.
--      Classe A = produtos que juntos explicam os primeiros 80% do lucro
--      Classe B = ate 95%        Classe C = o restante (cauda longa)
--    Lucro = receita dos itens - custo da epoca da venda (preco_custo_momento).
--    Vendas canceladas nao entram. Produtos com ficha tecnica usam o custo da receita.
CREATE OR ALTER FUNCTION dbo.fn_CurvaABC (@dias INT)
RETURNS TABLE
AS RETURN
(
    WITH VendasProduto AS (
        SELECT I.id_produto,
               SUM(I.quantidade)                                   AS qtd_vendida,
               SUM(I.subtotal)                                     AS receita,
               SUM(I.quantidade * I.preco_custo_momento)           AS custo,
               SUM(I.subtotal - I.quantidade * I.preco_custo_momento) AS lucro
        FROM dbo.ItensVenda I
        JOIN dbo.Vendas V ON V.id_venda = I.id_venda AND V.status_venda = 'CONCLUIDA'
        WHERE V.data_venda >= DATEADD(DAY, -@dias, SYSDATETIME())
        GROUP BY I.id_produto
    ),
    Ranking AS (
        SELECT VP.id_produto, P.nome, VP.qtd_vendida, VP.receita, VP.custo, VP.lucro,
               SUM(VP.lucro) OVER () AS lucro_total,
               SUM(VP.lucro) OVER (ORDER BY VP.lucro DESC, VP.id_produto
                                   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS lucro_acumulado
        FROM VendasProduto VP
        JOIN dbo.Produtos P ON P.id_produto = VP.id_produto
    )
    SELECT id_produto,
           nome AS produto,
           qtd_vendida,
           receita,
           custo,
           lucro,
           CASE WHEN receita > 0 THEN CAST(100.0 * lucro / receita AS DECIMAL(7,2)) ELSE 0 END AS margem_pct,
           CASE WHEN lucro_total > 0 THEN CAST(100.0 * lucro / lucro_total AS DECIMAL(7,2)) ELSE 0 END AS pct_lucro,
           CASE WHEN lucro_total > 0 THEN CAST(100.0 * lucro_acumulado / lucro_total AS DECIMAL(7,2)) ELSE 0 END AS pct_acumulado,
           CASE WHEN lucro_total <= 0 THEN 'C'
                WHEN 100.0 * (lucro_acumulado - lucro) / lucro_total < 80 THEN 'A'
                WHEN 100.0 * (lucro_acumulado - lucro) / lucro_total < 95 THEN 'B'
                ELSE 'C' END AS classe
    FROM Ranking
);
GO

-- 2. ESTOQUE PARADO --------------------------------------------------------------
--    Produtos com saldo em estoque e SEM nenhuma saida (venda ou uso como ingrediente)
--    nos ultimos @dias. Produto novo conta a partir da data de cadastro.
--    capital_parado = estoque_atual x preco_custo = dinheiro "dormindo" na prateleira.
CREATE OR ALTER FUNCTION dbo.fn_EstoqueParado (@dias INT)
RETURNS TABLE
AS RETURN
(
    SELECT P.id_produto,
           P.nome AS produto,
           P.estoque_atual,
           P.preco_custo,
           CAST(P.estoque_atual * P.preco_custo AS DECIMAL(12,2)) AS capital_parado,
           UM.ultima_saida,
           DATEDIFF(DAY, ISNULL(UM.ultima_saida, P.data_cadastro), SYSDATETIME()) AS dias_parado
    FROM dbo.Produtos P
    LEFT JOIN (
        SELECT H.id_produto, MAX(H.data_movimento) AS ultima_saida
        FROM dbo.Historico_Movimentacao_Estoque H
        LEFT JOIN dbo.Vendas V ON V.id_venda = H.id_venda
        WHERE H.tipo_movimento = 'SAIDA'
          AND (H.id_venda IS NULL OR V.status_venda = 'CONCLUIDA')
        GROUP BY H.id_produto
    ) UM ON UM.id_produto = P.id_produto
    WHERE P.ativo = 1
      AND P.estoque_atual > 0
      AND NOT EXISTS (SELECT 1 FROM dbo.FichaTecnica F WHERE F.id_produto = P.id_produto)
      AND ISNULL(UM.ultima_saida, P.data_cadastro) < DATEADD(DAY, -@dias, SYSDATETIME())
);
GO

-- 3. DIAS E HORARIOS DE PICO -------------------------------------------------------
--    Quantidade de vendas e faturamento por dia da semana x hora.
--    dia_semana_num: 0 = segunda ... 6 = domingo (calculado a partir de 01/01/1900, que
--    foi segunda-feira, para nao depender da configuracao de idioma do SQL Server).
CREATE OR ALTER FUNCTION dbo.fn_PicoVendas (@dias INT)
RETURNS TABLE
AS RETURN
(
    SELECT DATEDIFF(DAY, '19000101', CAST(V.data_venda AS DATE)) % 7 AS dia_semana_num,
           DATEPART(HOUR, V.data_venda)                            AS hora,
           COUNT(*)                                                AS qtd_vendas,
           SUM(V.valor_total - V.valor_desconto)                   AS faturamento
    FROM dbo.Vendas V
    WHERE V.status_venda = 'CONCLUIDA'
      AND V.data_venda >= DATEADD(DAY, -@dias, SYSDATETIME())
    GROUP BY DATEDIFF(DAY, '19000101', CAST(V.data_venda AS DATE)) % 7, DATEPART(HOUR, V.data_venda)
);
GO

PRINT '=== Funcoes analiticas instaladas com sucesso ===';
GO

/* TESTE RAPIDO (rode separado)
   SELECT * FROM dbo.fn_CurvaABC(90)      ORDER BY lucro DESC;
   SELECT * FROM dbo.fn_EstoqueParado(30) ORDER BY capital_parado DESC;
   SELECT * FROM dbo.fn_PicoVendas(90)    ORDER BY dia_semana_num, hora;
*/