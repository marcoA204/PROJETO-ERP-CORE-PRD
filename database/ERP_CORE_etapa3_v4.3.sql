/* ============================================================================
   ERP-CORE  -  ETAPA 3  (v4.3)   Migracao: NAO apaga dados.
   Rode UMA vez (pode rodar de novo sem problema) no banco ERP_PDV_Master,
   DEPOIS da v4.0, v4.1 e v4.2.
   Em seguida rode tambem  analytics/01_funcoes_analiticas.sql

   O QUE ENTRA  (conciliacao de taxas da maquininha)
   - TaxasPagamento: taxa % de cada forma de pagamento (ex.: debito 2%, credito 4%)
   - PagamentosVenda: taxa_percentual (congelada na hora da venda) e valor_taxa (calculado)
   - sp_SalvarTaxas
   - sp_RegistrarVenda (v4.3): grava a taxa vigente em cada pagamento
   - vw_FechamentoCaixa: + Taxas_Total e Faturamento_Liquido (colunas novas no final)
   - vw_ConciliacaoCaixa: por turno e forma de pagamento (bruto, taxa, liquido)
   - vw_RelatorioMensal_DRE: Lucro_Liquido agora desconta as taxas (+ coluna Taxas_Pagamento)

   OBS.: vendas ANTIGAS ficam com taxa 0% (a taxa nao existia na epoca).

   CODIGOS DE ERRO NOVOS (THROW)
     50150-50152  sp_SalvarTaxas
   Arquivo ASCII puro (sem acentos) de proposito.
   ============================================================================ */

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE ERP_PDV_Master;
GO

/* ============================================================================
   1. TABELAS E COLUNAS
   ============================================================================ */

IF OBJECT_ID('dbo.TaxasPagamento', 'U') IS NULL
CREATE TABLE dbo.TaxasPagamento (
    forma_pagamento VARCHAR(50)  NOT NULL CONSTRAINT PK_TaxasPagamento PRIMARY KEY,
    taxa_percentual DECIMAL(5,2) NOT NULL CONSTRAINT DF_Taxas_taxa DEFAULT 0,
    CONSTRAINT CK_Taxas_taxa CHECK (taxa_percentual >= 0 AND taxa_percentual <= 100)
);
GO

INSERT INTO dbo.TaxasPagamento (forma_pagamento)
SELECT v.f
FROM (VALUES ('DINHEIRO'), ('PIX'), ('CARTAO_DEBITO'), ('CARTAO_CREDITO'), ('BOLETO'), ('OUTROS')) v(f)
WHERE NOT EXISTS (SELECT 1 FROM dbo.TaxasPagamento t WHERE t.forma_pagamento = v.f);
GO

IF COL_LENGTH('dbo.PagamentosVenda', 'taxa_percentual') IS NULL
    ALTER TABLE dbo.PagamentosVenda ADD taxa_percentual DECIMAL(5,2) NOT NULL CONSTRAINT DF_Pagamentos_taxa DEFAULT 0;
GO
IF COL_LENGTH('dbo.PagamentosVenda', 'valor_taxa') IS NULL
    ALTER TABLE dbo.PagamentosVenda ADD valor_taxa AS CAST(ROUND(valor_pago * taxa_percentual / 100.0, 2) AS DECIMAL(10,2)) PERSISTED;
GO

/* ============================================================================
   2. PROCEDURES
   ============================================================================ */

-- 2.1 Salvar as taxas.  @taxas_json = [{"forma_pagamento":"CARTAO_DEBITO","taxa_percentual":2.0}, ...]
CREATE OR ALTER PROCEDURE dbo.sp_SalvarTaxas
    @taxas_json NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @msg NVARCHAR(2048), @problema NVARCHAR(100);
    DECLARE @t TABLE (forma_pagamento VARCHAR(50) NULL, taxa_percentual DECIMAL(5,2) NULL);
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('taxas=', LEFT(@taxas_json, 3000));

    BEGIN TRY
        IF ISNULL(ISJSON(@taxas_json), 0) <> 1
            THROW 50150, N'As taxas devem ser enviadas em JSON valido.', 1;

        INSERT INTO @t (forma_pagamento, taxa_percentual)
        SELECT UPPER(LTRIM(RTRIM(forma_pagamento))), taxa_percentual
        FROM OPENJSON(@taxas_json)
             WITH (forma_pagamento VARCHAR(50) '$.forma_pagamento', taxa_percentual DECIMAL(5,2) '$.taxa_percentual');

        IF NOT EXISTS (SELECT 1 FROM @t)
            THROW 50151, N'Nenhuma taxa informada.', 1;
        IF EXISTS (SELECT 1 FROM @t WHERE forma_pagamento IS NULL OR taxa_percentual IS NULL
                                       OR taxa_percentual < 0 OR taxa_percentual > 100)
            THROW 50151, N'Cada taxa precisa de uma forma de pagamento e de um percentual entre 0 e 100.', 1;

        SET @problema = (SELECT TOP 1 t.forma_pagamento FROM @t t
                         WHERE NOT EXISTS (SELECT 1 FROM dbo.TaxasPagamento x WHERE x.forma_pagamento = t.forma_pagamento));
        IF @problema IS NOT NULL
        BEGIN
            SET @msg = CONCAT(N'Forma de pagamento desconhecida: ', @problema, N'.');
            THROW 50152, @msg, 1;
        END

        UPDATE x
        SET x.taxa_percentual = t.taxa_percentual
        FROM dbo.TaxasPagamento x
        JOIN @t t ON t.forma_pagamento = x.forma_pagamento;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT = 0 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 2.2 VENDA COMPLETA (v4.3): igual a v4.2, mas cada pagamento guarda a taxa vigente.
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarVenda
    @id_caixa        INT,
    @valor_desconto  DECIMAL(10,2) = 0,
    @itens_json      NVARCHAR(MAX),
    @pagamentos_json NVARCHAR(MAX),
    @id_venda        INT = NULL OUTPUT,
    @id_cliente      INT = NULL,
    @id_orcamento    INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @msg NVARCHAR(2048), @problema NVARCHAR(200);
    DECLARE @total DECIMAL(10,2), @pago DECIMAL(10,2), @a_receber DECIMAL(10,2);
    DECLARE @detalhes NVARCHAR(4000) = CONCAT(
        'id_caixa=', @id_caixa, '; cliente=', @id_cliente, '; orcamento=', @id_orcamento,
        '; desconto=', @valor_desconto, '; itens=', LEFT(@itens_json, 1200),
        '; pagamentos=', LEFT(@pagamentos_json, 800));

    DECLARE @bruto   TABLE (codigo_barras VARCHAR(13) NULL, quantidade INT NULL);
    DECLARE @itens   TABLE (codigo_barras VARCHAR(13) NOT NULL, quantidade INT NOT NULL);
    DECLARE @linhas  TABLE (id_produto INT NOT NULL, quantidade INT NOT NULL, preco_venda DECIMAL(10,2) NOT NULL,
                            custo DECIMAL(10,2) NOT NULL, tem_ficha BIT NOT NULL);
    DECLARE @consumo TABLE (id_produto INT NOT NULL, qtd INT NOT NULL);
    DECLARE @pags    TABLE (forma_pagamento VARCHAR(50) NULL, valor_pago DECIMAL(10,2) NULL);

    BEGIN TRY
        IF @@TRANCOUNT > 0
            THROW 50069, N'sp_RegistrarVenda deve ser chamada sem transacao externa.', 1;

        SET @valor_desconto = ISNULL(@valor_desconto, 0);
        IF @valor_desconto < 0
            THROW 50060, N'Desconto nao pode ser negativo.', 1;
        IF ISNULL(ISJSON(@itens_json), 0) <> 1 OR ISNULL(ISJSON(@pagamentos_json), 0) <> 1
            THROW 50061, N'Itens e pagamentos devem ser enviados em JSON valido.', 1;
        IF @id_caixa IS NULL
           OR NOT EXISTS (SELECT 1 FROM dbo.Controle_Caixa WHERE id_caixa = @id_caixa AND status_caixa = 'ABERTO')
            THROW 50062, N'Caixa nao existe ou esta fechado. Abra o caixa antes de vender.', 1;

        IF @id_cliente IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM dbo.Clientes WHERE id_cliente = @id_cliente AND ativo = 1)
            THROW 50140, N'Cliente nao encontrado.', 1;

        IF @id_orcamento IS NOT NULL
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.Orcamentos WHERE id_orcamento = @id_orcamento AND status = 'ABERTO')
                THROW 50141, N'Orcamento nao encontrado ou ja foi convertido/cancelado.', 1;
            IF EXISTS (SELECT 1 FROM dbo.Orcamentos
                       WHERE id_orcamento = @id_orcamento AND validade IS NOT NULL AND validade < CAST(SYSDATETIME() AS DATE))
                THROW 50142, N'Orcamento vencido. Gere um novo orcamento.', 1;
        END

        -- itens
        INSERT INTO @bruto (codigo_barras, quantidade)
        SELECT codigo_barras, quantidade
        FROM OPENJSON(@itens_json)
             WITH (codigo_barras VARCHAR(13) '$.codigo_barras', quantidade INT '$.quantidade');

        IF NOT EXISTS (SELECT 1 FROM @bruto)
            THROW 50063, N'A venda precisa de pelo menos um item.', 1;
        IF EXISTS (SELECT 1 FROM @bruto WHERE codigo_barras IS NULL OR quantidade IS NULL OR quantidade <= 0)
            THROW 50063, N'Todo item precisa de codigo_barras e quantidade maior que zero.', 1;

        INSERT INTO @itens (codigo_barras, quantidade)
        SELECT codigo_barras, SUM(quantidade) FROM @bruto GROUP BY codigo_barras;

        SET @problema = (SELECT TOP 1 i.codigo_barras FROM @itens i
                         WHERE NOT EXISTS (SELECT 1 FROM dbo.Produtos p
                                           WHERE p.codigo_barras = i.codigo_barras AND p.ativo = 1));
        IF @problema IS NOT NULL
        BEGIN
            SET @msg = CONCAT(N'Produto nao encontrado (codigo de barras ', @problema, N').');
            THROW 50064, @msg, 1;
        END

        -- linhas da venda: preco e custo SEMPRE do banco (custo = soma dos ingredientes, se tiver ficha)
        INSERT INTO @linhas (id_produto, quantidade, preco_venda, custo, tem_ficha)
        SELECT p.id_produto, i.quantidade, p.preco_venda,
               CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.FichaTecnica F WHERE F.id_produto = p.id_produto)
                         THEN (SELECT ISNULL(SUM(ing.preco_custo * F.quantidade), 0)
                               FROM dbo.FichaTecnica F
                               JOIN dbo.Produtos ing ON ing.id_produto = F.id_ingrediente
                               WHERE F.id_produto = p.id_produto)
                         ELSE p.preco_custo END AS DECIMAL(10,2)),
               CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.FichaTecnica F WHERE F.id_produto = p.id_produto)
                         THEN 1 ELSE 0 END AS BIT)
        FROM @itens i
        JOIN dbo.Produtos p ON p.codigo_barras = i.codigo_barras AND p.ativo = 1;

        -- o que sai do estoque: produtos sem ficha (eles mesmos) + ingredientes dos produtos com ficha
        INSERT INTO @consumo (id_produto, qtd)
        SELECT X.id_produto, SUM(X.qtd)
        FROM (
            SELECT l.id_produto AS id_produto, l.quantidade AS qtd
            FROM @linhas l WHERE l.tem_ficha = 0
            UNION ALL
            SELECT f.id_ingrediente, f.quantidade * l.quantidade
            FROM @linhas l
            JOIN dbo.FichaTecnica f ON f.id_produto = l.id_produto
            WHERE l.tem_ficha = 1
        ) X
        GROUP BY X.id_produto;

        -- pagamentos
        INSERT INTO @pags (forma_pagamento, valor_pago)
        SELECT UPPER(LTRIM(RTRIM(forma_pagamento))), valor_pago
        FROM OPENJSON(@pagamentos_json)
             WITH (forma_pagamento VARCHAR(50) '$.forma_pagamento', valor_pago DECIMAL(10,2) '$.valor_pago');

        IF NOT EXISTS (SELECT 1 FROM @pags)
            THROW 50065, N'A venda precisa de pelo menos um pagamento.', 1;
        IF EXISTS (SELECT 1 FROM @pags WHERE forma_pagamento IS NULL OR valor_pago IS NULL OR valor_pago <= 0)
            THROW 50065, N'Todo pagamento precisa de forma_pagamento e valor_pago maior que zero.', 1;

        BEGIN TRANSACTION;

        -- trava e confere o estoque de tudo que vai sair (produtos e ingredientes)
        SET @problema = (SELECT TOP 1 p.nome
                         FROM @consumo c
                         JOIN dbo.Produtos AS p WITH (UPDLOCK, HOLDLOCK) ON p.id_produto = c.id_produto
                         WHERE p.estoque_atual < c.qtd);
        IF @problema IS NOT NULL
        BEGIN
            SET @msg = CONCAT(N'Estoque insuficiente para: ', @problema, N'.');
            THROW 50066, @msg, 1;
        END

        INSERT INTO dbo.Vendas (id_caixa, valor_desconto, id_cliente)
        VALUES (@id_caixa, @valor_desconto, @id_cliente);
        SET @id_venda = SCOPE_IDENTITY();

        INSERT INTO dbo.ItensVenda (id_venda, id_produto, quantidade, preco_unitario_praticado, preco_custo_momento)
        SELECT @id_venda, l.id_produto, l.quantidade, l.preco_venda, l.custo FROM @linhas l;

        UPDATE p
        SET p.estoque_atual = p.estoque_atual - c.qtd
        FROM dbo.Produtos p
        JOIN @consumo c ON c.id_produto = p.id_produto;

        INSERT INTO dbo.Historico_Movimentacao_Estoque
            (id_produto, tipo_movimento, quantidade, estoque_resultante, motivo, id_venda)
        SELECT p.id_produto, 'SAIDA', c.qtd, p.estoque_atual,
               CONCAT('Venda ID: ', @id_venda,
                      CASE WHEN EXISTS (SELECT 1 FROM @linhas l WHERE l.id_produto = c.id_produto AND l.tem_ficha = 0)
                           THEN '' ELSE ' (ficha tecnica)' END),
               @id_venda
        FROM @consumo c
        JOIN dbo.Produtos p ON p.id_produto = c.id_produto;

        SELECT @total = SUM(subtotal) FROM dbo.ItensVenda WHERE id_venda = @id_venda;
        IF @valor_desconto > @total
            THROW 50067, N'Desconto maior que o total da venda.', 1;

        SET @a_receber = @total - @valor_desconto;
        SELECT @pago = SUM(valor_pago) FROM @pags;
        IF @pago <> @a_receber
        BEGIN
            SET @msg = CONCAT(N'Soma dos pagamentos (', @pago, N') diferente do total a receber (', @a_receber, N').');
            THROW 50068, @msg, 1;
        END

        UPDATE dbo.Vendas SET valor_total = @total WHERE id_venda = @id_venda;

        -- a taxa vigente fica GRAVADA no pagamento: mudar a taxa depois nao altera vendas antigas
        INSERT INTO dbo.PagamentosVenda (id_venda, forma_pagamento, valor_pago, taxa_percentual)
        SELECT @id_venda, p.forma_pagamento, p.valor_pago, ISNULL(t.taxa_percentual, 0)
        FROM @pags p
        LEFT JOIN dbo.TaxasPagamento t ON t.forma_pagamento = p.forma_pagamento;

        IF @id_orcamento IS NOT NULL
            UPDATE dbo.Orcamentos SET status = 'CONVERTIDO', id_venda = @id_venda
            WHERE id_orcamento = @id_orcamento AND status = 'ABERTO';

        COMMIT TRANSACTION;

        SELECT @id_venda AS id_venda, @total AS valor_total, @valor_desconto AS valor_desconto, @a_receber AS valor_a_receber;
    END TRY
    BEGIN CATCH
        IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        SET @id_venda = NULL;
        EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

/* ============================================================================
   3. VIEWS
   ============================================================================ */

-- Conferencia de gaveta + taxas. Colunas novas no FINAL.
CREATE OR ALTER VIEW dbo.vw_FechamentoCaixa AS
SELECT C.id_caixa AS Turno,
       C.status_caixa AS Status,
       C.troco_inicial,
       ISNULL(SUM(P.valor_pago), 0) AS Faturamento_Total,
       C.troco_inicial + ISNULL(SUM(CASE WHEN P.forma_pagamento = 'DINHEIRO' THEN P.valor_pago ELSE 0 END), 0)
           AS Dinheiro_Em_Caixa_Fisico,
       ISNULL(SUM(P.valor_taxa), 0) AS Taxas_Total,
       ISNULL(SUM(P.valor_pago), 0) - ISNULL(SUM(P.valor_taxa), 0) AS Faturamento_Liquido
FROM dbo.Controle_Caixa C
LEFT JOIN dbo.Vendas V ON V.id_caixa = C.id_caixa AND V.status_venda = 'CONCLUIDA'
LEFT JOIN dbo.PagamentosVenda P ON P.id_venda = V.id_venda
GROUP BY C.id_caixa, C.status_caixa, C.troco_inicial;
GO

-- Conciliacao: por turno e forma de pagamento, quanto entrou bruto, quanto foi de taxa e quanto sobra
CREATE OR ALTER VIEW dbo.vw_ConciliacaoCaixa AS
SELECT V.id_caixa AS Turno,
       P.forma_pagamento,
       COUNT(*)                                AS qtd_pagamentos,
       SUM(P.valor_pago)                       AS valor_bruto,
       SUM(P.valor_taxa)                       AS valor_taxa,
       SUM(P.valor_pago) - SUM(P.valor_taxa)   AS valor_liquido
FROM dbo.PagamentosVenda P
JOIN dbo.Vendas V ON V.id_venda = P.id_venda AND V.status_venda = 'CONCLUIDA'
GROUP BY V.id_caixa, P.forma_pagamento;
GO

-- DRE mensal. Lucro_Liquido = faturamento - custo - despesas - TAXAS. Coluna nova no final.
CREATE OR ALTER VIEW dbo.vw_RelatorioMensal_DRE AS
WITH Vend AS (
    SELECT CONVERT(CHAR(7), V.data_venda, 23) AS Mes,
           SUM(V.valor_total)    AS Faturamento_Bruto,
           SUM(V.valor_desconto) AS Total_Descontos
    FROM dbo.Vendas V
    WHERE V.status_venda = 'CONCLUIDA'
    GROUP BY CONVERT(CHAR(7), V.data_venda, 23)
),
Custo AS (
    SELECT CONVERT(CHAR(7), V.data_venda, 23) AS Mes,
           SUM(I.quantidade * I.preco_custo_momento) AS Custo_Produtos
    FROM dbo.ItensVenda I
    JOIN dbo.Vendas V ON V.id_venda = I.id_venda
    WHERE V.status_venda = 'CONCLUIDA'
    GROUP BY CONVERT(CHAR(7), V.data_venda, 23)
),
Desp AS (
    SELECT CONVERT(CHAR(7), D.data_pagamento, 23) AS Mes,
           SUM(D.valor_total) AS Total_Despesas
    FROM dbo.Despesas D
    WHERE D.status_pagamento = 'PAGO'
    GROUP BY CONVERT(CHAR(7), D.data_pagamento, 23)
),
Taxa AS (
    SELECT CONVERT(CHAR(7), V.data_venda, 23) AS Mes,
           SUM(P.valor_taxa) AS Total_Taxas
    FROM dbo.PagamentosVenda P
    JOIN dbo.Vendas V ON V.id_venda = P.id_venda
    WHERE V.status_venda = 'CONCLUIDA'
    GROUP BY CONVERT(CHAR(7), V.data_venda, 23)
),
Meses AS (
    SELECT Mes FROM Vend UNION SELECT Mes FROM Custo UNION SELECT Mes FROM Desp UNION SELECT Mes FROM Taxa
)
SELECT M.Mes,
       ISNULL(V.Faturamento_Bruto, 0) - ISNULL(V.Total_Descontos, 0) AS Faturamento_Real_Recebido,
       ISNULL(C.Custo_Produtos, 0)  AS Custo_Produtos,
       ISNULL(D.Total_Despesas, 0)  AS Despesas_Operacionais,
       ISNULL(V.Faturamento_Bruto, 0) - ISNULL(V.Total_Descontos, 0)
         - ISNULL(C.Custo_Produtos, 0) - ISNULL(D.Total_Despesas, 0) - ISNULL(T.Total_Taxas, 0) AS Lucro_Liquido,
       ISNULL(T.Total_Taxas, 0)     AS Taxas_Pagamento
FROM Meses M
LEFT JOIN Vend  V ON V.Mes = M.Mes
LEFT JOIN Custo C ON C.Mes = M.Mes
LEFT JOIN Desp  D ON D.Mes = M.Mes
LEFT JOIN Taxa  T ON T.Mes = M.Mes;
GO

PRINT '=== ERP-CORE etapa 3 (v4.3) instalada com sucesso ===';
GO

/* TESTE RAPIDO (rode separado)
   SELECT * FROM TaxasPagamento;
   EXEC dbo.sp_SalvarTaxas @taxas_json = N'[{"forma_pagamento":"CARTAO_DEBITO","taxa_percentual":2},{"forma_pagamento":"CARTAO_CREDITO","taxa_percentual":4}]';
   -- faca uma venda no cartao de credito pelo PDV e depois:
   SELECT * FROM vw_ConciliacaoCaixa;
   SELECT * FROM vw_RelatorioMensal_DRE;
   SELECT * FROM vw_ErrosRecentes;
*/