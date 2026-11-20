/* ============================================================================
   ERP-CORE  -  ESTRUTURA DO BANCO  v4.0
   Banco: ERP_PDV_Master (mesmo nome do .env, nao precisa mudar nada)

   COMO USAR
   - So para banco NOVO (ou ainda na v4.0): NAO apaga dados. Se o banco ja
     estiver na v4.4, o arquivo e pulado (trava logo apos o USE). Tabelas existentes sao mantidas,
     procedures e views sao atualizadas (CREATE OR ALTER).
   - Para comecar do zero (so em desenvolvimento) rode antes o arquivo
     ERP_CORE_00_reset_dev.sql
   - Este arquivo e ASCII puro (sem acentos) de proposito: evita textos
     quebrados por problema de codificacao do arquivo.

   O QUE MUDOU EM RELACAO A v3.3
   1. CONSTRAINTS com nome (CHECK, FK, UNIQUE): preco negativo, estoque
      negativo, status invalido, etc. sao barrados pelo proprio banco, e a
      mensagem de erro diz exatamente qual regra foi violada.
   2. Tabela Log_Erros + procedure sp_RegistrarErro: toda procedure grava o
      erro (com os parametros recebidos) antes de relancar.
      Para consultar:  SELECT * FROM vw_ErrosRecentes;
   3. Procedures validam tudo e usam THROW com mensagem clara e codigo fixo.
   4. sp_RegistrarVenda: a venda inteira (itens + pagamentos) em UMA chamada
      e UMA transacao, com baixa de estoque protegida contra venda dupla.
   5. sp_AbrirCaixa / sp_FecharCaixa / sp_EntradaEstoque.
   6. Vendas passam a ter status (CONCLUIDA/CANCELADA) e os relatorios
      ignoram vendas canceladas.
   7. Indices nas colunas de FK e datas (consultas rapidas).
   8. DRE corrigida: mes so com despesa, sem venda, tambem aparece.

   CODIGOS DE ERRO (THROW) - os que aparecem no Log_Erros e no Node
     50020-50025  sp_SalvarProduto
     50030-50033  sp_RegistrarItemVenda (compatibilidade com o fluxo antigo)
     50040-50043  sp_AbrirCaixa / sp_FecharCaixa
     50050-50052  sp_EntradaEstoque
     50060-50069  sp_RegistrarVenda
   ============================================================================ */

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

IF DB_ID('ERP_PDV_Master') IS NULL
    CREATE DATABASE ERP_PDV_Master;
GO

USE ERP_PDV_Master;
GO

/* TRAVA DE SEGURANCA
   Se as etapas 4.1 a 4.4 ja foram aplicadas (a tabela Usuarios so existe a partir
   da 4.4), rodar este arquivo de novo VOLTARIA procedures e views para a v4.0
   (sp_RegistrarVenda, vw_CatalogoProdutos, vw_RelatorioMensal_DRE ...), quebrando
   vendas, taxas e ficha tecnica. Nesse caso o arquivo inteiro e pulado:
   SET NOEXEC ON faz o SQL Server apenas conferir os comandos, sem executar nada,
   ate o SET NOEXEC OFF no fim do arquivo.
   Para reaplicar tudo, use 00_aplicar_todas_na_ordem.sql (v4.0 -> etapa4). */
IF OBJECT_ID('dbo.Usuarios', 'U') IS NOT NULL
BEGIN
    -- severidade 10 = aviso (nao e erro): assim o 00_aplicar_todas_na_ordem.sql segue para as etapas
    RAISERROR('ATENCAO: o banco ja esta na v4.4. Este script v4.0 foi PULADO para nao desfazer as etapas 4.1-4.4. Nada foi alterado.', 10, 1) WITH NOWAIT;
    SET NOEXEC ON;
END
GO

/* ============================================================================
   1. TABELAS
   ============================================================================ */

IF OBJECT_ID('dbo.Categorias', 'U') IS NULL
CREATE TABLE dbo.Categorias (
    id_categoria INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Categorias PRIMARY KEY,
    -- CI_AI = ignora maiusculas e acentos: "Eletronico" e "ELETRONICO" sao a mesma categoria
    nome VARCHAR(100) COLLATE Latin1_General_CI_AI NOT NULL CONSTRAINT UQ_Categorias_nome UNIQUE
);
GO

IF OBJECT_ID('dbo.Marcas', 'U') IS NULL
CREATE TABLE dbo.Marcas (
    id_marca INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Marcas PRIMARY KEY,
    nome VARCHAR(100) COLLATE Latin1_General_CI_AI NOT NULL CONSTRAINT UQ_Marcas_nome UNIQUE
);
GO

IF OBJECT_ID('dbo.Produtos', 'U') IS NULL
CREATE TABLE dbo.Produtos (
    id_produto     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Produtos PRIMARY KEY,
    nome           VARCHAR(100)    NOT NULL,
    preco_custo    DECIMAL(10,2)   NOT NULL CONSTRAINT DF_Produtos_custo   DEFAULT 0,
    preco_venda    DECIMAL(10,2)   NOT NULL,
    estoque_atual  INT             NOT NULL CONSTRAINT DF_Produtos_estoque DEFAULT 0,
    estoque_minimo INT             NOT NULL CONSTRAINT DF_Produtos_minimo  DEFAULT 5,
    codigo_barras  VARCHAR(13)     NULL,
    id_categoria   INT             NULL CONSTRAINT FK_Produtos_Categorias REFERENCES dbo.Categorias(id_categoria),
    id_marca       INT             NULL CONSTRAINT FK_Produtos_Marcas     REFERENCES dbo.Marcas(id_marca),
    ativo          BIT             NOT NULL CONSTRAINT DF_Produtos_ativo   DEFAULT 1,
    data_cadastro  DATETIME2(0)    NOT NULL CONSTRAINT DF_Produtos_data    DEFAULT SYSDATETIME(),
    CONSTRAINT CK_Produtos_precos  CHECK (preco_custo >= 0 AND preco_venda >= 0),
    -- rede de seguranca: o banco NUNCA aceita estoque negativo, mesmo que o codigo tenha bug
    CONSTRAINT CK_Produtos_estoque CHECK (estoque_atual >= 0 AND estoque_minimo >= 0)
);
GO

-- Busca instantanea por codigo de barras (PDV). Dois produtos ATIVOS nao podem ter o mesmo codigo.
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UIX_Produtos_Codigo' AND object_id = OBJECT_ID('dbo.Produtos'))
    CREATE UNIQUE INDEX UIX_Produtos_Codigo ON dbo.Produtos(codigo_barras)
    WHERE ativo = 1 AND codigo_barras IS NOT NULL;
GO

IF OBJECT_ID('dbo.Controle_Caixa', 'U') IS NULL
CREATE TABLE dbo.Controle_Caixa (
    id_caixa        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Controle_Caixa PRIMARY KEY,
    data_abertura   DATETIME2(0)  NOT NULL CONSTRAINT DF_Caixa_abertura DEFAULT SYSDATETIME(),
    troco_inicial   DECIMAL(10,2) NOT NULL CONSTRAINT DF_Caixa_troco    DEFAULT 0,
    data_fechamento DATETIME2(0)  NULL,
    status_caixa    VARCHAR(10)   NOT NULL CONSTRAINT DF_Caixa_status   DEFAULT 'ABERTO',
    CONSTRAINT CK_Caixa_status     CHECK (status_caixa IN ('ABERTO', 'FECHADO')),
    CONSTRAINT CK_Caixa_troco      CHECK (troco_inicial >= 0),
    CONSTRAINT CK_Caixa_fechamento CHECK (
        (status_caixa = 'ABERTO'  AND data_fechamento IS NULL) OR
        (status_caixa = 'FECHADO' AND data_fechamento IS NOT NULL))
);
GO

-- Apenas UM caixa aberto por vez. Se a loja tiver varios caixas no futuro,
-- basta apagar este indice:  DROP INDEX UIX_Caixa_UmAberto ON dbo.Controle_Caixa;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UIX_Caixa_UmAberto' AND object_id = OBJECT_ID('dbo.Controle_Caixa'))
    CREATE UNIQUE INDEX UIX_Caixa_UmAberto ON dbo.Controle_Caixa(status_caixa)
    WHERE status_caixa = 'ABERTO';
GO

IF OBJECT_ID('dbo.Vendas', 'U') IS NULL
CREATE TABLE dbo.Vendas (
    id_venda       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Vendas PRIMARY KEY,
    id_caixa       INT           NOT NULL CONSTRAINT FK_Vendas_Caixa REFERENCES dbo.Controle_Caixa(id_caixa),
    data_venda     DATETIME2(0)  NOT NULL CONSTRAINT DF_Vendas_data     DEFAULT SYSDATETIME(),
    valor_total    DECIMAL(10,2) NOT NULL CONSTRAINT DF_Vendas_total    DEFAULT 0,
    valor_desconto DECIMAL(10,2) NOT NULL CONSTRAINT DF_Vendas_desconto DEFAULT 0,
    status_venda   VARCHAR(10)   NOT NULL CONSTRAINT DF_Vendas_status   DEFAULT 'CONCLUIDA',
    CONSTRAINT CK_Vendas_valores CHECK (valor_total >= 0 AND valor_desconto >= 0),
    CONSTRAINT CK_Vendas_status  CHECK (status_venda IN ('CONCLUIDA', 'CANCELADA'))
);
GO

IF OBJECT_ID('dbo.PagamentosVenda', 'U') IS NULL
CREATE TABLE dbo.PagamentosVenda (
    id_pagamento    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PagamentosVenda PRIMARY KEY,
    id_venda        INT           NOT NULL CONSTRAINT FK_Pagamentos_Vendas REFERENCES dbo.Vendas(id_venda),
    forma_pagamento VARCHAR(50)   NOT NULL,
    valor_pago      DECIMAL(10,2) NOT NULL,
    CONSTRAINT CK_Pagamentos_forma CHECK (forma_pagamento IN
        ('DINHEIRO', 'PIX', 'CARTAO_DEBITO', 'CARTAO_CREDITO', 'BOLETO', 'OUTROS')),
    CONSTRAINT CK_Pagamentos_valor CHECK (valor_pago > 0)
);
GO

IF OBJECT_ID('dbo.ItensVenda', 'U') IS NULL
CREATE TABLE dbo.ItensVenda (
    id_item                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ItensVenda PRIMARY KEY,
    id_venda                 INT           NOT NULL CONSTRAINT FK_Itens_Vendas   REFERENCES dbo.Vendas(id_venda),
    id_produto               INT           NOT NULL CONSTRAINT FK_Itens_Produtos REFERENCES dbo.Produtos(id_produto),
    quantidade               INT           NOT NULL,
    preco_unitario_praticado DECIMAL(10,2) NOT NULL,
    preco_custo_momento      DECIMAL(10,2) NOT NULL,
    subtotal AS (quantidade * preco_unitario_praticado) PERSISTED,
    CONSTRAINT CK_Itens_quantidade CHECK (quantidade > 0),
    CONSTRAINT CK_Itens_precos     CHECK (preco_unitario_praticado >= 0 AND preco_custo_momento >= 0)
);
GO

IF OBJECT_ID('dbo.Historico_Movimentacao_Estoque', 'U') IS NULL
CREATE TABLE dbo.Historico_Movimentacao_Estoque (
    id_movimento        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Historico_Estoque PRIMARY KEY,
    id_produto          INT          NOT NULL CONSTRAINT FK_Historico_Produtos REFERENCES dbo.Produtos(id_produto),
    data_movimento      DATETIME2(0) NOT NULL CONSTRAINT DF_Historico_data    DEFAULT SYSDATETIME(),
    tipo_movimento      VARCHAR(10)  NOT NULL,
    quantidade          INT          NOT NULL,
    estoque_resultante  INT          NULL,   -- saldo do produto logo apos o movimento (facilita auditoria)
    motivo              VARCHAR(100) NOT NULL,
    usuario_responsavel VARCHAR(50)  NOT NULL CONSTRAINT DF_Historico_usuario DEFAULT 'Sistema',
    CONSTRAINT CK_Historico_tipo       CHECK (tipo_movimento IN ('ENTRADA', 'SAIDA')),
    CONSTRAINT CK_Historico_quantidade CHECK (quantidade > 0)
);
GO

IF OBJECT_ID('dbo.Despesas', 'U') IS NULL
CREATE TABLE dbo.Despesas (
    id_despesa       INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Despesas PRIMARY KEY,
    descricao        VARCHAR(100)  NOT NULL,
    data_vencimento  DATE          NOT NULL,
    valor_total      DECIMAL(10,2) NOT NULL,
    status_pagamento VARCHAR(10)   NOT NULL CONSTRAINT DF_Despesas_status DEFAULT 'PENDENTE',
    data_pagamento   DATE          NULL,
    CONSTRAINT CK_Despesas_valor  CHECK (valor_total > 0),
    CONSTRAINT CK_Despesas_status CHECK (
        (status_pagamento = 'PENDENTE' AND data_pagamento IS NULL) OR
        (status_pagamento = 'PAGO'     AND data_pagamento IS NOT NULL))
);
GO

-- Registro de erros: quando algo falhar, e aqui que se descobre o que foi.
IF OBJECT_ID('dbo.Log_Erros', 'U') IS NULL
CREATE TABLE dbo.Log_Erros (
    id_erro     BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Log_Erros PRIMARY KEY,
    data_erro   DATETIME2(0)  NOT NULL CONSTRAINT DF_Log_data    DEFAULT SYSDATETIME(),
    origem      VARCHAR(128)  NULL,       -- nome da procedure onde o erro ocorreu
    numero_erro INT           NULL,
    severidade  INT           NULL,
    estado      INT           NULL,
    linha       INT           NULL,
    mensagem    NVARCHAR(4000) NOT NULL,
    detalhes    NVARCHAR(4000) NULL,      -- parametros recebidos pela procedure
    usuario_sql VARCHAR(128)  NOT NULL CONSTRAINT DF_Log_usuario DEFAULT SUSER_SNAME()
);
GO

/* ---- Indices de apoio (colunas de FK e datas) ---- */
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Produtos_categoria' AND object_id = OBJECT_ID('dbo.Produtos'))
    CREATE INDEX IX_Produtos_categoria ON dbo.Produtos(id_categoria);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Produtos_marca' AND object_id = OBJECT_ID('dbo.Produtos'))
    CREATE INDEX IX_Produtos_marca ON dbo.Produtos(id_marca);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Vendas_caixa' AND object_id = OBJECT_ID('dbo.Vendas'))
    CREATE INDEX IX_Vendas_caixa ON dbo.Vendas(id_caixa);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Vendas_data' AND object_id = OBJECT_ID('dbo.Vendas'))
    CREATE INDEX IX_Vendas_data ON dbo.Vendas(data_venda);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pagamentos_venda' AND object_id = OBJECT_ID('dbo.PagamentosVenda'))
    CREATE INDEX IX_Pagamentos_venda ON dbo.PagamentosVenda(id_venda);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ItensVenda_venda' AND object_id = OBJECT_ID('dbo.ItensVenda'))
    CREATE INDEX IX_ItensVenda_venda ON dbo.ItensVenda(id_venda);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_ItensVenda_Produto' AND object_id = OBJECT_ID('dbo.ItensVenda'))
    CREATE INDEX IX_ItensVenda_Produto ON dbo.ItensVenda(id_produto);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Historico_produto_data' AND object_id = OBJECT_ID('dbo.Historico_Movimentacao_Estoque'))
    CREATE INDEX IX_Historico_produto_data ON dbo.Historico_Movimentacao_Estoque(id_produto, data_movimento);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Despesas_status_venc' AND object_id = OBJECT_ID('dbo.Despesas'))
    CREATE INDEX IX_Despesas_status_venc ON dbo.Despesas(status_pagamento, data_vencimento);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Log_Erros_data' AND object_id = OBJECT_ID('dbo.Log_Erros'))
    CREATE INDEX IX_Log_Erros_data ON dbo.Log_Erros(data_erro DESC);
GO

/* ============================================================================
   2. PROCEDURES
   Padrao de todas: SET XACT_ABORT ON (qualquer erro desfaz a transacao),
   validacao no inicio, THROW com codigo >= 50000, e no CATCH:
   ROLLBACK -> grava no Log_Erros -> relanca o erro para o Node.
   ============================================================================ */

-- 2.0 Grava o erro atual no Log_Erros. So deve ser chamada de dentro de um CATCH.
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarErro
    @detalhes NVARCHAR(4000) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRY
        INSERT INTO dbo.Log_Erros (origem, numero_erro, severidade, estado, linha, mensagem, detalhes)
        VALUES (ERROR_PROCEDURE(), ERROR_NUMBER(), ERROR_SEVERITY(), ERROR_STATE(), ERROR_LINE(),
                ISNULL(ERROR_MESSAGE(), N'(sem mensagem)'), @detalhes);
    END TRY
    BEGIN CATCH
        RETURN;  -- o log nunca pode derrubar a operacao principal
    END CATCH
END
GO

-- 2.1 Cadastrar produto (cria categoria/marca sozinho). Mesmos parametros da v3.3.
CREATE OR ALTER PROCEDURE dbo.sp_SalvarProduto
    @nome            VARCHAR(100),
    @preco_custo     DECIMAL(10,2),
    @preco_venda     DECIMAL(10,2),
    @estoque_inicial INT,
    @estoque_minimo  INT = 5,
    @codigo_barras   VARCHAR(13)  = NULL,
    @nome_categoria  VARCHAR(100) = NULL,
    @nome_marca      VARCHAR(100) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @id_cat INT = NULL, @id_mar INT = NULL, @id_novo INT;
    DECLARE @detalhes NVARCHAR(4000) = CONCAT(
        'nome=', @nome, '; custo=', @preco_custo, '; venda=', @preco_venda,
        '; estoque_inicial=', @estoque_inicial, '; estoque_minimo=', @estoque_minimo,
        '; codigo_barras=', @codigo_barras, '; categoria=', @nome_categoria, '; marca=', @nome_marca);

    BEGIN TRY
        SET @nome           = LTRIM(RTRIM(ISNULL(@nome, '')));
        SET @codigo_barras  = NULLIF(LTRIM(RTRIM(@codigo_barras)), '');
        SET @nome_categoria = NULLIF(LTRIM(RTRIM(@nome_categoria)), '');
        SET @nome_marca     = NULLIF(LTRIM(RTRIM(@nome_marca)), '');
        SET @estoque_minimo = ISNULL(@estoque_minimo, 5);

        IF @nome = ''
            THROW 50020, N'Nome do produto e obrigatorio.', 1;
        IF @preco_custo IS NULL OR @preco_custo < 0 OR @preco_venda IS NULL OR @preco_venda < 0
            THROW 50021, N'Precos de custo e de venda sao obrigatorios e nao podem ser negativos.', 1;
        IF @estoque_inicial IS NULL OR @estoque_inicial < 0
            THROW 50022, N'Estoque inicial e obrigatorio e nao pode ser negativo.', 1;
        IF @estoque_minimo < 0
            THROW 50023, N'Estoque minimo nao pode ser negativo.', 1;
        IF @codigo_barras IS NOT NULL
           AND EXISTS (SELECT 1 FROM dbo.Produtos WHERE codigo_barras = @codigo_barras AND ativo = 1)
            THROW 50024, N'Ja existe um produto ativo com este codigo de barras.', 1;

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

        IF @nome_marca IS NOT NULL
        BEGIN
            SELECT @id_mar = id_marca FROM dbo.Marcas WHERE nome = @nome_marca;
            IF @id_mar IS NULL
            BEGIN
                INSERT INTO dbo.Marcas (nome) VALUES (@nome_marca);
                SET @id_mar = SCOPE_IDENTITY();
            END
        END

        INSERT INTO dbo.Produtos (nome, preco_custo, preco_venda, estoque_atual, estoque_minimo,
                                  codigo_barras, id_categoria, id_marca)
        VALUES (@nome, @preco_custo, @preco_venda, @estoque_inicial, @estoque_minimo,
                @codigo_barras, @id_cat, @id_mar);
        SET @id_novo = SCOPE_IDENTITY();

        -- Sem codigo informado: gera um codigo interno de 13 digitos (200 + id)
        IF @codigo_barras IS NULL
            UPDATE dbo.Produtos
            SET codigo_barras = '200' + RIGHT('0000000000' + CAST(@id_novo AS VARCHAR(10)), 10)
            WHERE id_produto = @id_novo;

        INSERT INTO dbo.Historico_Movimentacao_Estoque
            (id_produto, tipo_movimento, quantidade, estoque_resultante, motivo)
        SELECT @id_novo, 'ENTRADA', @estoque_inicial, @estoque_inicial, 'Cadastro inicial'
        WHERE @estoque_inicial > 0;

        IF @propria = 1 COMMIT TRANSACTION;

        SELECT @id_novo AS id_produto;
    END TRY
    BEGIN CATCH
        IF @propria = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        -- se a transacao pertence ao chamador, ele desfaz tudo (inclusive um log gravado aqui)
        IF @propria = 1 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 2.2 Abrir caixa. Devolve o id do caixa aberto.
CREATE OR ALTER PROCEDURE dbo.sp_AbrirCaixa
    @troco_inicial DECIMAL(10,2) = 0,
    @id_caixa      INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('troco_inicial=', @troco_inicial);

    BEGIN TRY
        SET @troco_inicial = ISNULL(@troco_inicial, 0);
        IF @troco_inicial < 0
            THROW 50040, N'Troco inicial nao pode ser negativo.', 1;
        IF EXISTS (SELECT 1 FROM dbo.Controle_Caixa WHERE status_caixa = 'ABERTO')
            THROW 50041, N'Ja existe um caixa aberto. Feche-o antes de abrir outro.', 1;

        INSERT INTO dbo.Controle_Caixa (troco_inicial) VALUES (@troco_inicial);
        SET @id_caixa = SCOPE_IDENTITY();

        SELECT @id_caixa AS id_caixa;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT = 0 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 2.3 Fechar caixa. Devolve o resumo do turno.
CREATE OR ALTER PROCEDURE dbo.sp_FecharCaixa
    @id_caixa INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('id_caixa=', @id_caixa);

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.Controle_Caixa WHERE id_caixa = @id_caixa)
            THROW 50042, N'Caixa nao encontrado.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.Controle_Caixa WHERE id_caixa = @id_caixa AND status_caixa = 'ABERTO')
            THROW 50043, N'Este caixa ja esta fechado.', 1;

        UPDATE dbo.Controle_Caixa
        SET status_caixa = 'FECHADO', data_fechamento = SYSDATETIME()
        WHERE id_caixa = @id_caixa;

        SELECT * FROM dbo.vw_FechamentoCaixa WHERE Turno = @id_caixa;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT = 0 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 2.4 Entrada de mercadoria no estoque (compra / reposicao).
CREATE OR ALTER PROCEDURE dbo.sp_EntradaEstoque
    @id_produto INT,
    @quantidade INT,
    @motivo     VARCHAR(100) = 'Entrada de mercadoria'
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @novo_estoque INT;
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('id_produto=', @id_produto, '; quantidade=', @quantidade, '; motivo=', @motivo);

    BEGIN TRY
        SET @motivo = ISNULL(NULLIF(LTRIM(RTRIM(@motivo)), ''), 'Entrada de mercadoria');
        IF @quantidade IS NULL OR @quantidade <= 0
            THROW 50050, N'Quantidade deve ser maior que zero.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.Produtos WHERE id_produto = @id_produto AND ativo = 1)
            THROW 50051, N'Produto nao encontrado ou inativo.', 1;

        IF @propria = 1 BEGIN TRANSACTION;

        UPDATE dbo.Produtos
        SET estoque_atual = estoque_atual + @quantidade,
            @novo_estoque = estoque_atual + @quantidade
        WHERE id_produto = @id_produto;

        INSERT INTO dbo.Historico_Movimentacao_Estoque
            (id_produto, tipo_movimento, quantidade, estoque_resultante, motivo)
        VALUES (@id_produto, 'ENTRADA', @quantidade, @novo_estoque, @motivo);

        IF @propria = 1 COMMIT TRANSACTION;

        SELECT @id_produto AS id_produto, @novo_estoque AS estoque_atual;
    END TRY
    BEGIN CATCH
        IF @propria = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        IF @propria = 1 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- 2.5 VENDA COMPLETA EM UMA CHAMADA (recomendado).
--     @itens_json      = [{"codigo_barras":"2000000000001","quantidade":2}]
--     @pagamentos_json = [{"forma_pagamento":"PIX","valor_pago":20.00}]
--     Regras: caixa precisa estar ABERTO; estoque suficiente; a soma dos pagamentos
--     deve ser IGUAL a (total - desconto). Tudo ou nada: se qualquer passo falhar,
--     nada e gravado e o motivo vai para o Log_Erros.
--     Chame SEM transacao externa (a propria procedure controla a transacao).
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarVenda
    @id_caixa        INT,
    @valor_desconto  DECIMAL(10,2) = 0,
    @itens_json      NVARCHAR(MAX),
    @pagamentos_json NVARCHAR(MAX),
    @id_venda        INT = NULL OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @msg NVARCHAR(2048), @problema NVARCHAR(200);
    DECLARE @total DECIMAL(10,2), @pago DECIMAL(10,2), @a_receber DECIMAL(10,2);
    DECLARE @detalhes NVARCHAR(4000) = CONCAT(
        'id_caixa=', @id_caixa, '; desconto=', @valor_desconto,
        '; itens=', LEFT(@itens_json, 1500), '; pagamentos=', LEFT(@pagamentos_json, 1000));

    DECLARE @bruto TABLE (codigo_barras VARCHAR(13) NULL, quantidade INT NULL);
    DECLARE @itens TABLE (codigo_barras VARCHAR(13) NOT NULL, quantidade INT NOT NULL);
    DECLARE @pags  TABLE (forma_pagamento VARCHAR(50) NULL, valor_pago DECIMAL(10,2) NULL);

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

        -- trava os produtos da venda e confere o estoque (evita duas vendas simultaneas do mesmo item)
        SET @problema = (SELECT TOP 1 p.nome
                         FROM @itens i
                         JOIN dbo.Produtos AS p WITH (UPDLOCK, HOLDLOCK)
                              ON p.codigo_barras = i.codigo_barras AND p.ativo = 1
                         WHERE p.estoque_atual < i.quantidade);
        IF @problema IS NOT NULL
        BEGIN
            SET @msg = CONCAT(N'Estoque insuficiente para o produto: ', @problema, N'.');
            THROW 50066, @msg, 1;
        END

        INSERT INTO dbo.Vendas (id_caixa, valor_desconto) VALUES (@id_caixa, @valor_desconto);
        SET @id_venda = SCOPE_IDENTITY();

        -- o preco e o custo vem SEMPRE do banco (nunca do navegador)
        INSERT INTO dbo.ItensVenda (id_venda, id_produto, quantidade, preco_unitario_praticado, preco_custo_momento)
        SELECT @id_venda, p.id_produto, i.quantidade, p.preco_venda, p.preco_custo
        FROM @itens i
        JOIN dbo.Produtos p ON p.codigo_barras = i.codigo_barras AND p.ativo = 1;

        UPDATE p
        SET p.estoque_atual = p.estoque_atual - i.quantidade
        FROM dbo.Produtos p
        JOIN @itens i ON p.codigo_barras = i.codigo_barras AND p.ativo = 1;

        INSERT INTO dbo.Historico_Movimentacao_Estoque
            (id_produto, tipo_movimento, quantidade, estoque_resultante, motivo)
        SELECT p.id_produto, 'SAIDA', i.quantidade, p.estoque_atual, CONCAT('Venda ID: ', @id_venda)
        FROM @itens i
        JOIN dbo.Produtos p ON p.codigo_barras = i.codigo_barras AND p.ativo = 1;

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

-- 2.6 Registrar item em uma venda ja criada (FLUXO ANTIGO, mantido para compatibilidade
--     com o vendaController atual). Se for chamada dentro de uma transacao do Node,
--     o erro nao e gravado no Log_Erros (o rollback do Node desfaria o log); nesse caso
--     o erro aparece apenas no terminal. Prefira sp_RegistrarVenda.
CREATE OR ALTER PROCEDURE dbo.sp_RegistrarItemVenda
    @id_venda      INT,
    @codigo_barras VARCHAR(13),
    @quantidade    INT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @msg NVARCHAR(2048);
    DECLARE @id_p INT, @prcV DECIMAL(10,2), @prcC DECIMAL(10,2), @estoque INT;
    DECLARE @r TABLE (id_produto INT, preco_venda DECIMAL(10,2), preco_custo DECIMAL(10,2), estoque INT);
    DECLARE @detalhes NVARCHAR(4000) = CONCAT(
        'id_venda=', @id_venda, '; codigo_barras=', @codigo_barras, '; quantidade=', @quantidade);

    BEGIN TRY
        IF @quantidade IS NULL OR @quantidade <= 0
            THROW 50030, N'Quantidade deve ser maior que zero.', 1;
        IF NOT EXISTS (SELECT 1 FROM dbo.Vendas WHERE id_venda = @id_venda)
            THROW 50031, N'Venda nao encontrada.', 1;

        IF @propria = 1 BEGIN TRANSACTION;

        -- baixa atomica: so baixa se houver estoque suficiente
        UPDATE dbo.Produtos
        SET estoque_atual = estoque_atual - @quantidade
        OUTPUT inserted.id_produto, inserted.preco_venda, inserted.preco_custo, inserted.estoque_atual INTO @r
        WHERE codigo_barras = @codigo_barras AND ativo = 1 AND estoque_atual >= @quantidade;

        IF NOT EXISTS (SELECT 1 FROM @r)
        BEGIN
            IF EXISTS (SELECT 1 FROM dbo.Produtos WHERE codigo_barras = @codigo_barras AND ativo = 1)
            BEGIN
                SET @msg = CONCAT(N'Estoque insuficiente para o codigo de barras ', @codigo_barras, N'.');
                THROW 50032, @msg, 1;
            END
            SET @msg = CONCAT(N'Produto nao encontrado (codigo de barras ', ISNULL(@codigo_barras, N'vazio'), N').');
            THROW 50033, @msg, 1;
        END

        SELECT @id_p = id_produto, @prcV = preco_venda, @prcC = preco_custo, @estoque = estoque FROM @r;

        INSERT INTO dbo.ItensVenda (id_venda, id_produto, quantidade, preco_unitario_praticado, preco_custo_momento)
        VALUES (@id_venda, @id_p, @quantidade, @prcV, @prcC);

        INSERT INTO dbo.Historico_Movimentacao_Estoque
            (id_produto, tipo_movimento, quantidade, estoque_resultante, motivo)
        VALUES (@id_p, 'SAIDA', @quantidade, @estoque, CONCAT('Venda ID: ', @id_venda));

        UPDATE dbo.Vendas SET valor_total = valor_total + (@quantidade * @prcV) WHERE id_venda = @id_venda;

        IF @propria = 1 COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @propria = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        IF @propria = 1 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

/* ============================================================================
   3. VIEWS
   (vw_CatalogoProdutos mantem exatamente as mesmas colunas da v3.3: o frontend
    atual continua funcionando sem alteracao)
   ============================================================================ */

CREATE OR ALTER VIEW dbo.vw_CatalogoProdutos AS
SELECT P.codigo_barras,
       P.nome AS Produto,
       ISNULL(C.nome, 'Geral') AS Categoria,
       ISNULL(M.nome, 'Geral') AS Marca,
       P.estoque_atual,
       P.preco_venda,
       P.id_produto,
       P.estoque_minimo
FROM dbo.Produtos P
LEFT JOIN dbo.Categorias C ON P.id_categoria = C.id_categoria
LEFT JOIN dbo.Marcas M     ON P.id_marca = M.id_marca
WHERE P.ativo = 1;
GO

CREATE OR ALTER VIEW dbo.vw_SugestaoCompra AS
SELECT P.nome AS Produto,
       P.estoque_atual,
       P.estoque_minimo,
       (P.estoque_minimo - P.estoque_atual + 1) AS Qtd_Comprar,
       P.preco_custo
FROM dbo.Produtos P
WHERE P.estoque_atual <= P.estoque_minimo AND P.ativo = 1;
GO

-- Conferencia de gaveta. Considera apenas vendas CONCLUIDAS.
CREATE OR ALTER VIEW dbo.vw_FechamentoCaixa AS
SELECT C.id_caixa AS Turno,
       C.status_caixa AS Status,
       C.troco_inicial,
       ISNULL(SUM(P.valor_pago), 0) AS Faturamento_Total,
       C.troco_inicial + ISNULL(SUM(CASE WHEN P.forma_pagamento = 'DINHEIRO' THEN P.valor_pago ELSE 0 END), 0)
           AS Dinheiro_Em_Caixa_Fisico
FROM dbo.Controle_Caixa C
LEFT JOIN dbo.Vendas V ON V.id_caixa = C.id_caixa AND V.status_venda = 'CONCLUIDA'
LEFT JOIN dbo.PagamentosVenda P ON P.id_venda = V.id_venda
GROUP BY C.id_caixa, C.status_caixa, C.troco_inicial;
GO

-- DRE mensal. Ignora vendas canceladas; mostra tambem meses que tiveram so despesa.
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
Meses AS (
    SELECT Mes FROM Vend UNION SELECT Mes FROM Custo UNION SELECT Mes FROM Desp
)
SELECT M.Mes,
       ISNULL(V.Faturamento_Bruto, 0) - ISNULL(V.Total_Descontos, 0) AS Faturamento_Real_Recebido,
       ISNULL(C.Custo_Produtos, 0)  AS Custo_Produtos,
       ISNULL(D.Total_Despesas, 0)  AS Despesas_Operacionais,
       ISNULL(V.Faturamento_Bruto, 0) - ISNULL(V.Total_Descontos, 0)
         - ISNULL(C.Custo_Produtos, 0) - ISNULL(D.Total_Despesas, 0) AS Lucro_Liquido
FROM Meses M
LEFT JOIN Vend  V ON V.Mes = M.Mes
LEFT JOIN Custo C ON C.Mes = M.Mes
LEFT JOIN Desp  D ON D.Mes = M.Mes;
GO

-- Ultimos 100 erros registrados (o mais recente primeiro).
CREATE OR ALTER VIEW dbo.vw_ErrosRecentes AS
SELECT TOP (100) id_erro, data_erro, origem, numero_erro, mensagem, detalhes, usuario_sql
FROM dbo.Log_Erros
ORDER BY id_erro DESC;
GO

PRINT '=== ERP-CORE estrutura v4.0 instalada/atualizada com sucesso ===';
GO

/* ============================================================================
   TESTE RAPIDO (copie e rode separado, depois de instalar)

   EXEC dbo.sp_AbrirCaixa @troco_inicial = 100;
   EXEC dbo.sp_SalvarProduto @nome='Cimento 50kg', @preco_custo=22, @preco_venda=30,
        @estoque_inicial=100, @estoque_minimo=20, @nome_categoria='Basico', @nome_marca='Votorantim';

   DECLARE @v INT;
   EXEC dbo.sp_RegistrarVenda
        @id_caixa = 1, @valor_desconto = 0,
        @itens_json      = N'[{"codigo_barras":"2000000000001","quantidade":2}]',
        @pagamentos_json = N'[{"forma_pagamento":"PIX","valor_pago":60.00}]',
        @id_venda = @v OUTPUT;

   SELECT * FROM vw_CatalogoProdutos;
   SELECT * FROM vw_ErrosRecentes;     -- aqui aparecem os erros, se houver
   ============================================================================ */

/* ============================================================================
   OPCIONAL (seguranca): em vez de o Node usar o usuario "sa", crie um usuario
   so para o app. Depois troque DB_USER / DB_PASSWORD no .env.

   USE master;  CREATE LOGIN erp_app WITH PASSWORD = 'TroqueEstaSenhaForte#2026';
   USE ERP_PDV_Master;
   CREATE USER erp_app FOR LOGIN erp_app;
   GRANT SELECT  ON SCHEMA::dbo TO erp_app;
   GRANT EXECUTE ON SCHEMA::dbo TO erp_app;
   (Se o vendaController/caixaController antigos ainda fazem INSERT direto,
    de tambem:  GRANT INSERT, UPDATE ON SCHEMA::dbo TO erp_app;)
   ============================================================================ */

-- Fim da trava de seguranca do inicio do arquivo (volta a executar normalmente)
SET NOEXEC OFF;
GO
