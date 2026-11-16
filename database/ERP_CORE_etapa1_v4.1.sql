/* ============================================================================
   ERP-CORE  -  ETAPA 1  (v4.1)   Migracao: NAO apaga dados.
   Rode UMA vez (pode rodar de novo sem problema) no banco ERP_PDV_Master,
   DEPOIS da estrutura v4.0.

   O QUE ENTRA
   - Vendas: colunas motivo_cancelamento e data_cancelamento
   - vw_CatalogoProdutos: nova coluna preco_custo (no final, nao quebra nada)
   - sp_AtualizarProduto / sp_InativarProduto  (edicao e inativacao de produto)
   - sp_LancarDespesa / sp_PagarDespesa        (contas a pagar: pendente x pago)
   - sp_CancelarVenda                          (cancela e devolve ao estoque)
   - vw_ContasPagar / vw_HistoricoVendas

   CODIGOS DE ERRO NOVOS (THROW)
     50070-50075  sp_AtualizarProduto / sp_InativarProduto
     50080-50083  sp_LancarDespesa / sp_PagarDespesa
     50090-50092  sp_CancelarVenda
   Arquivo ASCII puro (sem acentos) de proposito.
   ============================================================================ */

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE ERP_PDV_Master;
GO

-- 1. Colunas novas (auditoria de cancelamento)
IF COL_LENGTH('dbo.Vendas', 'motivo_cancelamento') IS NULL
    ALTER TABLE dbo.Vendas ADD motivo_cancelamento VARCHAR(200) NULL;
GO
IF COL_LENGTH('dbo.Vendas', 'data_cancelamento') IS NULL
    ALTER TABLE dbo.Vendas ADD data_cancelamento DATETIME2(0) NULL;
GO

-- 2. Views -------------------------------------------------------------------
-- Mesmas colunas de antes + preco_custo no final (usado na tela de edicao)
CREATE OR ALTER VIEW dbo.vw_CatalogoProdutos AS
SELECT P.codigo_barras,
       P.nome AS Produto,
       ISNULL(C.nome, 'Geral') AS Categoria,
       ISNULL(M.nome, 'Geral') AS Marca,
       P.estoque_atual,
       P.preco_venda,
       P.id_produto,
       P.estoque_minimo,
       P.preco_custo
FROM dbo.Produtos P
LEFT JOIN dbo.Categorias C ON P.id_categoria = C.id_categoria
LEFT JOIN dbo.Marcas M     ON P.id_marca = M.id_marca
WHERE P.ativo = 1;
GO

-- Contas a pagar com a situacao ja calculada (PAGA / ATRASADA / VENCE HOJE / A VENCER)
CREATE OR ALTER VIEW dbo.vw_ContasPagar AS
SELECT D.id_despesa,
       D.descricao,
       D.data_vencimento,
       D.valor_total,
       D.status_pagamento,
       D.data_pagamento,
       DATEDIFF(DAY, CAST(SYSDATETIME() AS DATE), D.data_vencimento) AS dias_para_vencer,
       CASE WHEN D.status_pagamento = 'PAGO'                                THEN 'PAGA'
            WHEN D.data_vencimento < CAST(SYSDATETIME() AS DATE)            THEN 'ATRASADA'
            WHEN D.data_vencimento = CAST(SYSDATETIME() AS DATE)            THEN 'VENCE HOJE'
            ELSE 'A VENCER'
       END AS situacao
FROM dbo.Despesas D;
GO

CREATE OR ALTER VIEW dbo.vw_HistoricoVendas AS
SELECT V.id_venda,
       V.data_venda,
       V.id_caixa AS turno,
       V.valor_total,
       V.valor_desconto,
       (V.valor_total - V.valor_desconto) AS valor_a_receber,
       V.status_venda,
       V.motivo_cancelamento,
       ISNULL((SELECT SUM(I.quantidade) FROM dbo.ItensVenda I WHERE I.id_venda = V.id_venda), 0) AS qtd_itens
FROM dbo.Vendas V;
GO

-- 3. Procedures --------------------------------------------------------------

-- 3.1 Editar produto (nome, precos, minimo, categoria). Estoque NAO muda aqui:
--     para mexer no saldo use sp_EntradaEstoque (reposicao) ou venda/cancelamento.
CREATE OR ALTER PROCEDURE dbo.sp_AtualizarProduto
    @id_produto     INT,
    @nome           VARCHAR(100),
    @preco_custo    DECIMAL(10,2),
    @preco_venda    DECIMAL(10,2),
    @estoque_minimo INT,
    @nome_categoria VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @id_cat INT = NULL;
    DECLARE @detalhes NVARCHAR(4000) = CONCAT(
        'id_produto=', @id_produto, '; nome=', @nome, '; custo=', @preco_custo,
        '; venda=', @preco_venda, '; minimo=', @estoque_minimo, '; categoria=', @nome_categoria);

    BEGIN TRY
        SET @nome = LTRIM(RTRIM(ISNULL(@nome, '')));
        SET @nome_categoria = NULLIF(LTRIM(RTRIM(@nome_categoria)), '');

        IF @nome = ''
            THROW 50070, N'Nome do produto e obrigatorio.', 1;
        IF @preco_custo IS NULL OR @preco_custo < 0 OR @preco_venda IS NULL OR @preco_venda < 0
            THROW 50071, N'Precos de custo e de venda sao obrigatorios e nao podem ser negativos.', 1;
        IF @estoque_minimo IS NULL OR @estoque_minimo < 0
            THROW 50072, N'Estoque minimo invalido.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.Produtos WHERE id_produto = @id_produto AND ativo = 1)
            THROW 50073, N'Produto nao encontrado ou inativo.', 1;

        IF @propria = 1 BEGIN TRANSACTION;

        IF @nome_categoria IS NOT NULL
        BEGIN
            SELECT @id_cat = id_categoria FROM dbo.Categorias WHERE nome = @nome_categoria;
            IF @id_cat IS NULL
            BEGIN
                INSERT INTO dbo.Categorias (nome) VALUES (@nome_categoria);
                SET @id_cat = SCOPE_IDENTITY();
            END
        END

        UPDATE dbo.Produtos
        SET nome           = @nome,
            preco_custo    = @preco_custo,
            preco_venda    = @preco_venda,
            estoque_minimo = @estoque_minimo,
            id_categoria   = CASE WHEN @nome_categoria IS NULL THEN id_categoria ELSE @id_cat END
        WHERE id_produto = @id_produto;

        IF @propria = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @propria = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        IF @propria = 1 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 3.2 Inativar produto (nao apaga: o historico de vendas continua intacto)
CREATE OR ALTER PROCEDURE dbo.sp_InativarProduto
    @id_produto INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('id_produto=', @id_produto);

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.Produtos WHERE id_produto = @id_produto)
            THROW 50074, N'Produto nao encontrado.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.Produtos WHERE id_produto = @id_produto AND ativo = 1)
            THROW 50075, N'Este produto ja esta inativo.', 1;

        UPDATE dbo.Produtos SET ativo = 0 WHERE id_produto = @id_produto;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT = 0 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 3.3 Lancar conta/despesa. @pago = 0 -> fica PENDENTE; @pago = 1 -> ja nasce PAGA (hoje).
CREATE OR ALTER PROCEDURE dbo.sp_LancarDespesa
    @descricao       VARCHAR(100),
    @valor_total     DECIMAL(10,2),
    @data_vencimento DATE = NULL,
    @pago            BIT = 0,
    @id_despesa      INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @hoje DATE = CAST(SYSDATETIME() AS DATE);
    DECLARE @detalhes NVARCHAR(4000) = CONCAT(
        'descricao=', @descricao, '; valor=', @valor_total, '; vencimento=', @data_vencimento, '; pago=', @pago);

    BEGIN TRY
        SET @descricao = LTRIM(RTRIM(ISNULL(@descricao, '')));
        SET @pago = ISNULL(@pago, 0);
        SET @data_vencimento = ISNULL(@data_vencimento, @hoje);

        IF @descricao = ''
            THROW 50080, N'Descricao da conta e obrigatoria.', 1;
        IF @valor_total IS NULL OR @valor_total <= 0
            THROW 50081, N'O valor da conta deve ser maior que zero.', 1;

        INSERT INTO dbo.Despesas (descricao, data_vencimento, valor_total, status_pagamento, data_pagamento)
        VALUES (@descricao, @data_vencimento, @valor_total,
                CASE WHEN @pago = 1 THEN 'PAGO' ELSE 'PENDENTE' END,
                CASE WHEN @pago = 1 THEN @hoje  ELSE NULL END);
        SET @id_despesa = SCOPE_IDENTITY();

        SELECT @id_despesa AS id_despesa;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT = 0 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 3.4 Dar baixa (pagar) uma conta pendente
CREATE OR ALTER PROCEDURE dbo.sp_PagarDespesa
    @id_despesa INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('id_despesa=', @id_despesa);

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.Despesas WHERE id_despesa = @id_despesa)
            THROW 50082, N'Conta nao encontrada.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.Despesas WHERE id_despesa = @id_despesa AND status_pagamento = 'PENDENTE')
            THROW 50083, N'Esta conta ja esta paga.', 1;

        UPDATE dbo.Despesas
        SET status_pagamento = 'PAGO', data_pagamento = CAST(SYSDATETIME() AS DATE)
        WHERE id_despesa = @id_despesa;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT = 0 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 3.5 Cancelar venda: marca como CANCELADA e devolve os itens ao estoque (com historico).
--     Regra: so cancela se o caixa da venda ainda estiver ABERTO (senao o fechamento
--     que ja foi conferido mudaria). Para liberar isso, apague o IF do erro 50092.
CREATE OR ALTER PROCEDURE dbo.sp_CancelarVenda
    @id_venda INT,
    @motivo   VARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @status VARCHAR(10), @id_caixa INT, @status_caixa VARCHAR(10);
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('id_venda=', @id_venda, '; motivo=', @motivo);

    BEGIN TRY
        SELECT @status = V.status_venda, @id_caixa = V.id_caixa
        FROM dbo.Vendas V WHERE V.id_venda = @id_venda;

        IF @status IS NULL
            THROW 50090, N'Venda nao encontrada.', 1;
        IF @status = 'CANCELADA'
            THROW 50091, N'Esta venda ja foi cancelada.', 1;

        SELECT @status_caixa = status_caixa FROM dbo.Controle_Caixa WHERE id_caixa = @id_caixa;
        IF @status_caixa <> 'ABERTO'
            THROW 50092, N'O caixa desta venda ja foi fechado. O cancelamento so e permitido com o caixa aberto.', 1;

        SET @motivo = NULLIF(LTRIM(RTRIM(@motivo)), '');

        IF @propria = 1 BEGIN TRANSACTION;

        -- devolve ao estoque (soma por produto)
        UPDATE P
        SET P.estoque_atual = P.estoque_atual + X.qtd
        FROM dbo.Produtos P
        JOIN (SELECT id_produto, SUM(quantidade) AS qtd
              FROM dbo.ItensVenda WHERE id_venda = @id_venda GROUP BY id_produto) X
             ON X.id_produto = P.id_produto;

        INSERT INTO dbo.Historico_Movimentacao_Estoque
            (id_produto, tipo_movimento, quantidade, estoque_resultante, motivo)
        SELECT X.id_produto, 'ENTRADA', X.qtd, P.estoque_atual,
               LEFT(CONCAT('Estorno venda ID: ', @id_venda,
                           CASE WHEN @motivo IS NULL THEN '' ELSE CONCAT(' - ', @motivo) END), 100)
        FROM (SELECT id_produto, SUM(quantidade) AS qtd
              FROM dbo.ItensVenda WHERE id_venda = @id_venda GROUP BY id_produto) X
        JOIN dbo.Produtos P ON P.id_produto = X.id_produto;

        UPDATE dbo.Vendas
        SET status_venda = 'CANCELADA', motivo_cancelamento = @motivo, data_cancelamento = SYSDATETIME()
        WHERE id_venda = @id_venda;

        IF @propria = 1 COMMIT TRANSACTION;

        SELECT @id_venda AS id_venda, 'CANCELADA' AS status_venda;
    END TRY
    BEGIN CATCH
        IF @propria = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        IF @propria = 1 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

PRINT '=== ERP-CORE etapa 1 (v4.1) instalada com sucesso ===';
GO

/* TESTE RAPIDO (rode separado)
   EXEC dbo.sp_LancarDespesa @descricao='Boleto fornecedor', @valor_total=150, @data_vencimento='2026-11-10', @pago=0;
   SELECT * FROM vw_ContasPagar;          -- deve aparecer como ATRASADA
   SELECT * FROM vw_HistoricoVendas;
   SELECT * FROM vw_ErrosRecentes;
*/
