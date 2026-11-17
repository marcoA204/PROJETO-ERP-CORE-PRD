/* ============================================================================
   ERP-CORE  -  ETAPA 2  (v4.2)   Migracao: NAO apaga dados.
   Rode UMA vez (pode rodar de novo sem problema) no banco ERP_PDV_Master,
   DEPOIS da v4.0 e da v4.1.

   O QUE ENTRA
   - Clientes (CRM leve) + vinculo da venda com o cliente
   - Orcamentos (nao baixam estoque) + conversao em venda no PDV
   - Perfil do negocio (VAREJO / ALIMENTACAO) na tabela Configuracoes
   - Ficha Tecnica: vender 1 produto com receita da baixa nos INGREDIENTES
   - sp_RegistrarVenda e sp_CancelarVenda atualizadas (cliente, orcamento, ficha)
   - Historico de estoque passa a guardar o id_venda (estorno exato)

   REGRA DA FICHA TECNICA
   - Ingredientes sao produtos normais, cadastrados na menor unidade
     (ex.: farinha em GRAMAS, leite em ML, ovo em UNIDADES).
   - Produto COM ficha: a venda NAO mexe no estoque dele, so no dos ingredientes.
   - O custo do produto na venda (DRE) vem da soma dos ingredientes.
   - Um ingrediente nao pode ter ficha propria (1 nivel apenas).

   CODIGOS DE ERRO NOVOS (THROW)
     50100-50105  clientes
     50110-50116  orcamentos
     50120-50125  ficha tecnica
     50130        perfil do negocio
     50140-50142  sp_RegistrarVenda (cliente / orcamento)
   Arquivo ASCII puro (sem acentos) de proposito.
   ============================================================================ */

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

USE ERP_PDV_Master;
GO

/* ============================================================================
   1. TABELAS
   ============================================================================ */

IF OBJECT_ID('dbo.Clientes', 'U') IS NULL
CREATE TABLE dbo.Clientes (
    id_cliente    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Clientes PRIMARY KEY,
    nome          VARCHAR(100) NOT NULL,
    whatsapp      VARCHAR(13)  NULL,     -- somente numeros, com DDD (ex.: 11912345678)
    documento     VARCHAR(14)  NULL,     -- CPF (11) ou CNPJ (14), somente numeros
    observacoes   VARCHAR(300) NULL,
    ativo         BIT          NOT NULL CONSTRAINT DF_Clientes_ativo DEFAULT 1,
    data_cadastro DATETIME2(0) NOT NULL CONSTRAINT DF_Clientes_data  DEFAULT SYSDATETIME(),
    CONSTRAINT CK_Clientes_nome      CHECK (LEN(LTRIM(RTRIM(nome))) > 0),
    CONSTRAINT CK_Clientes_whatsapp  CHECK (whatsapp IS NULL OR (whatsapp NOT LIKE '%[^0-9]%' AND LEN(whatsapp) BETWEEN 10 AND 13)),
    CONSTRAINT CK_Clientes_documento CHECK (documento IS NULL OR (documento NOT LIKE '%[^0-9]%' AND LEN(documento) IN (11, 14)))
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UIX_Clientes_documento' AND object_id = OBJECT_ID('dbo.Clientes'))
    CREATE UNIQUE INDEX UIX_Clientes_documento ON dbo.Clientes(documento)
    WHERE documento IS NOT NULL AND ativo = 1;
GO

IF OBJECT_ID('dbo.Configuracoes', 'U') IS NULL
CREATE TABLE dbo.Configuracoes (
    chave VARCHAR(50)  NOT NULL CONSTRAINT PK_Configuracoes PRIMARY KEY,
    valor VARCHAR(200) NOT NULL
);
GO
IF NOT EXISTS (SELECT 1 FROM dbo.Configuracoes WHERE chave = 'nicho')
    INSERT INTO dbo.Configuracoes (chave, valor) VALUES ('nicho', 'VAREJO');
IF NOT EXISTS (SELECT 1 FROM dbo.Configuracoes WHERE chave = 'onboarding_concluido')
    INSERT INTO dbo.Configuracoes (chave, valor) VALUES ('onboarding_concluido', '0');
GO

IF OBJECT_ID('dbo.FichaTecnica', 'U') IS NULL
CREATE TABLE dbo.FichaTecnica (
    id_produto     INT NOT NULL CONSTRAINT FK_Ficha_Produto     REFERENCES dbo.Produtos(id_produto),
    id_ingrediente INT NOT NULL CONSTRAINT FK_Ficha_Ingrediente REFERENCES dbo.Produtos(id_produto),
    quantidade     INT NOT NULL,   -- quanto do ingrediente vai em 1 unidade do produto
    CONSTRAINT PK_FichaTecnica PRIMARY KEY (id_produto, id_ingrediente),
    CONSTRAINT CK_Ficha_quantidade CHECK (quantidade > 0),
    CONSTRAINT CK_Ficha_diferente  CHECK (id_produto <> id_ingrediente)
);
GO

IF OBJECT_ID('dbo.Orcamentos', 'U') IS NULL
CREATE TABLE dbo.Orcamentos (
    id_orcamento   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Orcamentos PRIMARY KEY,
    id_cliente     INT           NULL CONSTRAINT FK_Orcamentos_Clientes REFERENCES dbo.Clientes(id_cliente),
    data_criacao   DATETIME2(0)  NOT NULL CONSTRAINT DF_Orcamentos_data     DEFAULT SYSDATETIME(),
    validade       DATE          NULL,
    valor_desconto DECIMAL(10,2) NOT NULL CONSTRAINT DF_Orcamentos_desconto DEFAULT 0,
    observacoes    VARCHAR(300)  NULL,
    status         VARCHAR(10)   NOT NULL CONSTRAINT DF_Orcamentos_status   DEFAULT 'ABERTO',
    id_venda       INT           NULL CONSTRAINT FK_Orcamentos_Vendas REFERENCES dbo.Vendas(id_venda),
    CONSTRAINT CK_Orcamentos_desconto CHECK (valor_desconto >= 0),
    CONSTRAINT CK_Orcamentos_status   CHECK (status IN ('ABERTO', 'CONVERTIDO', 'CANCELADO'))
);
GO

IF OBJECT_ID('dbo.ItensOrcamento', 'U') IS NULL
CREATE TABLE dbo.ItensOrcamento (
    id_item        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ItensOrcamento PRIMARY KEY,
    id_orcamento   INT           NOT NULL CONSTRAINT FK_ItensOrc_Orcamentos REFERENCES dbo.Orcamentos(id_orcamento),
    id_produto     INT           NOT NULL CONSTRAINT FK_ItensOrc_Produtos   REFERENCES dbo.Produtos(id_produto),
    quantidade     INT           NOT NULL,
    preco_unitario DECIMAL(10,2) NOT NULL,   -- preco da epoca do orcamento
    CONSTRAINT CK_ItensOrc_quantidade CHECK (quantidade > 0),
    CONSTRAINT CK_ItensOrc_preco      CHECK (preco_unitario >= 0)
);
GO

-- Vendas: cliente opcional | Historico de estoque: de qual venda veio o movimento
IF COL_LENGTH('dbo.Vendas', 'id_cliente') IS NULL
    ALTER TABLE dbo.Vendas ADD id_cliente INT NULL CONSTRAINT FK_Vendas_Clientes REFERENCES dbo.Clientes(id_cliente);
GO
IF COL_LENGTH('dbo.Historico_Movimentacao_Estoque', 'id_venda') IS NULL
    ALTER TABLE dbo.Historico_Movimentacao_Estoque ADD id_venda INT NULL CONSTRAINT FK_Historico_Vendas REFERENCES dbo.Vendas(id_venda);
GO

-- Indices de apoio
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Vendas_cliente' AND object_id = OBJECT_ID('dbo.Vendas'))
    CREATE INDEX IX_Vendas_cliente ON dbo.Vendas(id_cliente);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Historico_venda' AND object_id = OBJECT_ID('dbo.Historico_Movimentacao_Estoque'))
    CREATE INDEX IX_Historico_venda ON dbo.Historico_Movimentacao_Estoque(id_venda);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Ficha_ingrediente' AND object_id = OBJECT_ID('dbo.FichaTecnica'))
    CREATE INDEX IX_Ficha_ingrediente ON dbo.FichaTecnica(id_ingrediente);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Orcamentos_cliente' AND object_id = OBJECT_ID('dbo.Orcamentos'))
    CREATE INDEX IX_Orcamentos_cliente ON dbo.Orcamentos(id_cliente);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ItensOrc_orcamento' AND object_id = OBJECT_ID('dbo.ItensOrcamento'))
    CREATE INDEX IX_ItensOrc_orcamento ON dbo.ItensOrcamento(id_orcamento);
GO

/* ============================================================================
   2. VIEWS (mesmas colunas de antes + colunas novas no FINAL)
   ============================================================================ */

CREATE OR ALTER VIEW dbo.vw_CatalogoProdutos AS
SELECT P.codigo_barras,
       P.nome AS Produto,
       ISNULL(C.nome, 'Geral') AS Categoria,
       ISNULL(M.nome, 'Geral') AS Marca,
       P.estoque_atual,
       P.preco_venda,
       P.id_produto,
       P.estoque_minimo,
       P.preco_custo,
       CAST(CASE WHEN EXISTS (SELECT 1 FROM dbo.FichaTecnica F WHERE F.id_produto = P.id_produto)
                 THEN 1 ELSE 0 END AS BIT) AS tem_ficha
FROM dbo.Produtos P
LEFT JOIN dbo.Categorias C ON P.id_categoria = C.id_categoria
LEFT JOIN dbo.Marcas M     ON P.id_marca = M.id_marca
WHERE P.ativo = 1;
GO

-- Produto com ficha tecnica nao tem estoque proprio: nao entra na sugestao de compra
CREATE OR ALTER VIEW dbo.vw_SugestaoCompra AS
SELECT P.nome AS Produto,
       P.estoque_atual,
       P.estoque_minimo,
       (P.estoque_minimo - P.estoque_atual + 1) AS Qtd_Comprar,
       P.preco_custo
FROM dbo.Produtos P
WHERE P.estoque_atual <= P.estoque_minimo
  AND P.ativo = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.FichaTecnica F WHERE F.id_produto = P.id_produto);
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
       ISNULL((SELECT SUM(I.quantidade) FROM dbo.ItensVenda I WHERE I.id_venda = V.id_venda), 0) AS qtd_itens,
       V.id_cliente,
       C.nome AS cliente_nome
FROM dbo.Vendas V
LEFT JOIN dbo.Clientes C ON C.id_cliente = V.id_cliente;
GO

CREATE OR ALTER VIEW dbo.vw_Orcamentos AS
SELECT O.id_orcamento,
       O.data_criacao,
       O.validade,
       O.status,
       CASE WHEN O.status = 'ABERTO' AND O.validade IS NOT NULL AND O.validade < CAST(SYSDATETIME() AS DATE)
            THEN 'EXPIRADO' ELSE O.status END AS situacao,
       O.id_cliente,
       C.nome     AS cliente_nome,
       C.whatsapp AS cliente_whatsapp,
       ISNULL(T.total, 0) AS valor_total,
       O.valor_desconto,
       ISNULL(T.total, 0) - O.valor_desconto AS valor_a_receber,
       O.id_venda,
       O.observacoes
FROM dbo.Orcamentos O
LEFT JOIN dbo.Clientes C ON C.id_cliente = O.id_cliente
LEFT JOIN (SELECT id_orcamento, SUM(quantidade * preco_unitario) AS total
           FROM dbo.ItensOrcamento GROUP BY id_orcamento) T ON T.id_orcamento = O.id_orcamento;
GO

/* ============================================================================
   3. PROCEDURES
   ============================================================================ */

-- 3.1 Criar ou editar cliente (@id_cliente NULL = novo)
CREATE OR ALTER PROCEDURE dbo.sp_SalvarCliente
    @id_cliente  INT = NULL,
    @nome        VARCHAR(100),
    @whatsapp    VARCHAR(20)  = NULL,
    @documento   VARCHAR(20)  = NULL,
    @observacoes VARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @detalhes NVARCHAR(4000) = CONCAT(
        'id_cliente=', @id_cliente, '; nome=', @nome, '; whatsapp=', @whatsapp, '; documento=', @documento);

    BEGIN TRY
        SET @nome        = LTRIM(RTRIM(ISNULL(@nome, '')));
        SET @whatsapp    = NULLIF(LTRIM(RTRIM(@whatsapp)), '');
        SET @documento   = NULLIF(LTRIM(RTRIM(@documento)), '');
        SET @observacoes = NULLIF(LTRIM(RTRIM(@observacoes)), '');

        IF @nome = ''
            THROW 50100, N'Nome do cliente e obrigatorio.', 1;
        IF @whatsapp IS NOT NULL AND (@whatsapp LIKE '%[^0-9]%' OR LEN(@whatsapp) NOT BETWEEN 10 AND 13)
            THROW 50101, N'WhatsApp invalido. Informe DDD + numero (somente numeros).', 1;
        IF @documento IS NOT NULL AND (@documento LIKE '%[^0-9]%' OR LEN(@documento) NOT IN (11, 14))
            THROW 50102, N'CPF/CNPJ invalido. Informe 11 (CPF) ou 14 (CNPJ) numeros.', 1;
        IF @documento IS NOT NULL
           AND EXISTS (SELECT 1 FROM dbo.Clientes
                       WHERE documento = @documento AND ativo = 1
                         AND (@id_cliente IS NULL OR id_cliente <> @id_cliente))
            THROW 50103, N'Ja existe um cliente com este CPF/CNPJ.', 1;

        IF @id_cliente IS NULL
        BEGIN
            INSERT INTO dbo.Clientes (nome, whatsapp, documento, observacoes)
            VALUES (@nome, @whatsapp, @documento, @observacoes);
            SET @id_cliente = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.Clientes WHERE id_cliente = @id_cliente AND ativo = 1)
                THROW 50104, N'Cliente nao encontrado.', 1;

            UPDATE dbo.Clientes
            SET nome = @nome, whatsapp = @whatsapp, documento = @documento, observacoes = @observacoes
            WHERE id_cliente = @id_cliente;
        END

        SELECT @id_cliente AS id_cliente;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT = 0 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 3.2 Inativar cliente (o historico de compras continua)
CREATE OR ALTER PROCEDURE dbo.sp_InativarCliente
    @id_cliente INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('id_cliente=', @id_cliente);

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.Clientes WHERE id_cliente = @id_cliente AND ativo = 1)
            THROW 50105, N'Cliente nao encontrado.', 1;

        UPDATE dbo.Clientes SET ativo = 0 WHERE id_cliente = @id_cliente;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT = 0 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 3.3 Perfil do negocio (onboarding): VAREJO ou ALIMENTACAO
CREATE OR ALTER PROCEDURE dbo.sp_SalvarNicho
    @nicho VARCHAR(20)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('nicho=', @nicho);

    BEGIN TRY
        SET @nicho = UPPER(LTRIM(RTRIM(ISNULL(@nicho, ''))));
        IF @nicho NOT IN ('VAREJO', 'ALIMENTACAO')
            THROW 50130, N'Perfil de negocio invalido. Use VAREJO ou ALIMENTACAO.', 1;

        IF @propria = 1 BEGIN TRANSACTION;

        UPDATE dbo.Configuracoes SET valor = @nicho WHERE chave = 'nicho';
        IF @@ROWCOUNT = 0 INSERT INTO dbo.Configuracoes (chave, valor) VALUES ('nicho', @nicho);

        UPDATE dbo.Configuracoes SET valor = '1' WHERE chave = 'onboarding_concluido';
        IF @@ROWCOUNT = 0 INSERT INTO dbo.Configuracoes (chave, valor) VALUES ('onboarding_concluido', '1');

        IF @propria = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @propria = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        IF @propria = 1 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 3.4 Salvar ficha tecnica (receita). Substitui a receita inteira do produto.
--     @ingredientes_json = [{"id_ingrediente":3,"quantidade":500},{"id_ingrediente":7,"quantidade":4}]
--     JSON vazio ([]) remove a ficha.
CREATE OR ALTER PROCEDURE dbo.sp_SalvarFichaTecnica
    @id_produto         INT,
    @ingredientes_json  NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @msg NVARCHAR(2048), @problema NVARCHAR(200);
    DECLARE @bruto TABLE (id_ingrediente INT NULL, quantidade INT NULL);
    DECLARE @final TABLE (id_ingrediente INT NOT NULL, quantidade INT NOT NULL);
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('id_produto=', @id_produto, '; ingredientes=', LEFT(@ingredientes_json, 3000));

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.Produtos WHERE id_produto = @id_produto AND ativo = 1)
            THROW 50120, N'Produto nao encontrado ou inativo.', 1;
        IF ISNULL(ISJSON(@ingredientes_json), 0) <> 1
            THROW 50121, N'Os ingredientes devem ser enviados em JSON valido.', 1;

        INSERT INTO @bruto (id_ingrediente, quantidade)
        SELECT id_ingrediente, quantidade
        FROM OPENJSON(@ingredientes_json)
             WITH (id_ingrediente INT '$.id_ingrediente', quantidade INT '$.quantidade');

        IF EXISTS (SELECT 1 FROM @bruto WHERE id_ingrediente IS NULL OR quantidade IS NULL OR quantidade <= 0)
            THROW 50122, N'Todo ingrediente precisa de um produto e de uma quantidade inteira maior que zero.', 1;
        IF EXISTS (SELECT 1 FROM @bruto WHERE id_ingrediente = @id_produto)
            THROW 50123, N'Um produto nao pode ser ingrediente dele mesmo.', 1;

        INSERT INTO @final (id_ingrediente, quantidade)
        SELECT id_ingrediente, SUM(quantidade) FROM @bruto GROUP BY id_ingrediente;

        SET @problema = (SELECT TOP 1 CAST(f.id_ingrediente AS VARCHAR(20)) FROM @final f
                         WHERE NOT EXISTS (SELECT 1 FROM dbo.Produtos p WHERE p.id_produto = f.id_ingrediente AND p.ativo = 1));
        IF @problema IS NOT NULL
        BEGIN
            SET @msg = CONCAT(N'Ingrediente nao encontrado ou inativo (id ', @problema, N').');
            THROW 50124, @msg, 1;
        END

        SET @problema = (SELECT TOP 1 p.nome FROM @final f
                         JOIN dbo.Produtos p ON p.id_produto = f.id_ingrediente
                         WHERE EXISTS (SELECT 1 FROM dbo.FichaTecnica x WHERE x.id_produto = f.id_ingrediente));
        IF @problema IS NOT NULL
        BEGIN
            SET @msg = CONCAT(N'"', @problema, N'" ja tem ficha tecnica propria e nao pode ser ingrediente.');
            THROW 50124, @msg, 1;
        END

        IF EXISTS (SELECT 1 FROM @final)
           AND EXISTS (SELECT 1 FROM dbo.FichaTecnica WHERE id_ingrediente = @id_produto)
            THROW 50125, N'Este produto e ingrediente de outra receita e nao pode ter ficha tecnica.', 1;

        IF @propria = 1 BEGIN TRANSACTION;

        DELETE FROM dbo.FichaTecnica WHERE id_produto = @id_produto;
        INSERT INTO dbo.FichaTecnica (id_produto, id_ingrediente, quantidade)
        SELECT @id_produto, id_ingrediente, quantidade FROM @final;

        IF @propria = 1 COMMIT TRANSACTION;

        SELECT COUNT(*) AS ingredientes FROM @final;
    END TRY
    BEGIN CATCH
        IF @propria = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        IF @propria = 1 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 3.5 Criar orcamento (NAO baixa estoque). Itens com o preco ATUAL do produto.
--     @itens_json = [{"codigo_barras":"2000000000001","quantidade":2}]
CREATE OR ALTER PROCEDURE dbo.sp_CriarOrcamento
    @id_cliente     INT = NULL,
    @validade       DATE = NULL,
    @valor_desconto DECIMAL(10,2) = 0,
    @observacoes    VARCHAR(300) = NULL,
    @itens_json     NVARCHAR(MAX),
    @id_orcamento   INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @msg NVARCHAR(2048), @problema NVARCHAR(200), @total DECIMAL(10,2);
    DECLARE @bruto TABLE (codigo_barras VARCHAR(13) NULL, quantidade INT NULL);
    DECLARE @itens TABLE (codigo_barras VARCHAR(13) NOT NULL, quantidade INT NOT NULL);
    DECLARE @detalhes NVARCHAR(4000) = CONCAT(
        'id_cliente=', @id_cliente, '; validade=', @validade, '; desconto=', @valor_desconto, '; itens=', LEFT(@itens_json, 3000));

    BEGIN TRY
        SET @valor_desconto = ISNULL(@valor_desconto, 0);
        SET @observacoes = NULLIF(LTRIM(RTRIM(@observacoes)), '');

        IF @valor_desconto < 0
            THROW 50110, N'Desconto nao pode ser negativo.', 1;
        IF @validade IS NOT NULL AND @validade < CAST(SYSDATETIME() AS DATE)
            THROW 50111, N'A validade do orcamento nao pode estar no passado.', 1;
        IF @id_cliente IS NOT NULL AND NOT EXISTS (SELECT 1 FROM dbo.Clientes WHERE id_cliente = @id_cliente AND ativo = 1)
            THROW 50112, N'Cliente nao encontrado.', 1;
        IF ISNULL(ISJSON(@itens_json), 0) <> 1
            THROW 50113, N'Os itens devem ser enviados em JSON valido.', 1;

        INSERT INTO @bruto (codigo_barras, quantidade)
        SELECT codigo_barras, quantidade
        FROM OPENJSON(@itens_json)
             WITH (codigo_barras VARCHAR(13) '$.codigo_barras', quantidade INT '$.quantidade');

        IF NOT EXISTS (SELECT 1 FROM @bruto)
            THROW 50113, N'O orcamento precisa de pelo menos um item.', 1;
        IF EXISTS (SELECT 1 FROM @bruto WHERE codigo_barras IS NULL OR quantidade IS NULL OR quantidade <= 0)
            THROW 50113, N'Todo item precisa de codigo_barras e quantidade maior que zero.', 1;

        INSERT INTO @itens (codigo_barras, quantidade)
        SELECT codigo_barras, SUM(quantidade) FROM @bruto GROUP BY codigo_barras;

        SET @problema = (SELECT TOP 1 i.codigo_barras FROM @itens i
                         WHERE NOT EXISTS (SELECT 1 FROM dbo.Produtos p WHERE p.codigo_barras = i.codigo_barras AND p.ativo = 1));
        IF @problema IS NOT NULL
        BEGIN
            SET @msg = CONCAT(N'Produto nao encontrado (codigo de barras ', @problema, N').');
            THROW 50114, @msg, 1;
        END

        SELECT @total = SUM(i.quantidade * p.preco_venda)
        FROM @itens i JOIN dbo.Produtos p ON p.codigo_barras = i.codigo_barras AND p.ativo = 1;
        IF @valor_desconto > @total
            THROW 50110, N'Desconto maior que o total do orcamento.', 1;

        IF @propria = 1 BEGIN TRANSACTION;

        INSERT INTO dbo.Orcamentos (id_cliente, validade, valor_desconto, observacoes)
        VALUES (@id_cliente, @validade, @valor_desconto, @observacoes);
        SET @id_orcamento = SCOPE_IDENTITY();

        INSERT INTO dbo.ItensOrcamento (id_orcamento, id_produto, quantidade, preco_unitario)
        SELECT @id_orcamento, p.id_produto, i.quantidade, p.preco_venda
        FROM @itens i JOIN dbo.Produtos p ON p.codigo_barras = i.codigo_barras AND p.ativo = 1;

        IF @propria = 1 COMMIT TRANSACTION;

        SELECT @id_orcamento AS id_orcamento;
    END TRY
    BEGIN CATCH
        IF @propria = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        SET @id_orcamento = NULL;
        IF @propria = 1 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 3.6 Cancelar orcamento (so os ABERTOS)
CREATE OR ALTER PROCEDURE dbo.sp_CancelarOrcamento
    @id_orcamento INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('id_orcamento=', @id_orcamento);

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.Orcamentos WHERE id_orcamento = @id_orcamento)
            THROW 50115, N'Orcamento nao encontrado.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.Orcamentos WHERE id_orcamento = @id_orcamento AND status = 'ABERTO')
            THROW 50116, N'Somente orcamentos em aberto podem ser cancelados.', 1;

        UPDATE dbo.Orcamentos SET status = 'CANCELADO' WHERE id_orcamento = @id_orcamento;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT = 0 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 3.7 VENDA COMPLETA (v4.2): agora com cliente, orcamento e ficha tecnica.
--     Produto COM ficha: baixa os ingredientes (e o custo da venda vem da receita).
--     Produto SEM ficha: baixa o proprio estoque, como antes.
--     @id_orcamento: se informado, o orcamento vira CONVERTIDO e fica ligado a esta venda.
--     Chame SEM transacao externa.
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

        INSERT INTO dbo.PagamentosVenda (id_venda, forma_pagamento, valor_pago)
        SELECT @id_venda, forma_pagamento, valor_pago FROM @pags;

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

-- 3.8 Cancelar venda (v4.2): devolve ao estoque EXATAMENTE o que saiu (le o historico da venda),
--     inclusive ingredientes de ficha tecnica. Vendas antigas (sem id_venda no historico)
--     voltam pelos itens, como antes. Regra: so com o caixa da venda ABERTO.
CREATE OR ALTER PROCEDURE dbo.sp_CancelarVenda
    @id_venda INT,
    @motivo   VARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @status VARCHAR(10), @id_caixa INT, @status_caixa VARCHAR(10);
    DECLARE @devolver TABLE (id_produto INT NOT NULL, qtd INT NOT NULL);
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

        IF EXISTS (SELECT 1 FROM dbo.Historico_Movimentacao_Estoque WHERE id_venda = @id_venda AND tipo_movimento = 'SAIDA')
        BEGIN
            INSERT INTO @devolver (id_produto, qtd)
            SELECT id_produto, SUM(quantidade)
            FROM dbo.Historico_Movimentacao_Estoque
            WHERE id_venda = @id_venda AND tipo_movimento = 'SAIDA'
            GROUP BY id_produto;
        END
        ELSE
        BEGIN
            INSERT INTO @devolver (id_produto, qtd)
            SELECT id_produto, SUM(quantidade)
            FROM dbo.ItensVenda WHERE id_venda = @id_venda GROUP BY id_produto;
        END

        UPDATE P
        SET P.estoque_atual = P.estoque_atual + D.qtd
        FROM dbo.Produtos P
        JOIN @devolver D ON D.id_produto = P.id_produto;

        INSERT INTO dbo.Historico_Movimentacao_Estoque
            (id_produto, tipo_movimento, quantidade, estoque_resultante, motivo, id_venda)
        SELECT D.id_produto, 'ENTRADA', D.qtd, P.estoque_atual,
               LEFT(CONCAT('Estorno venda ID: ', @id_venda,
                           CASE WHEN @motivo IS NULL THEN '' ELSE CONCAT(' - ', @motivo) END), 100),
               @id_venda
        FROM @devolver D
        JOIN dbo.Produtos P ON P.id_produto = D.id_produto;

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

PRINT '=== ERP-CORE etapa 2 (v4.2) instalada com sucesso ===';
GO

/* TESTE RAPIDO (rode separado)
   EXEC dbo.sp_SalvarCliente @nome = 'Seu Auricelio', @whatsapp = '11912345678';
   SELECT * FROM Clientes;
   SELECT * FROM Configuracoes;           -- nicho = VAREJO, onboarding_concluido = 0
   SELECT * FROM vw_CatalogoProdutos;     -- coluna tem_ficha no final
   SELECT * FROM vw_ErrosRecentes;
*/
