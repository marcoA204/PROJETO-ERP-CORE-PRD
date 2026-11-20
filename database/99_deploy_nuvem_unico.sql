/* ============================================================================
   LOGI FLOW - SCRIPT UNICO PARA BANCO NA NUVEM (gerado a partir de v4.0..v4.4)
   Abra conectado JA DENTRO do banco que a hospedagem criou e execute tudo (F5).
   Diferenca para os originais: sem CREATE DATABASE e sem "USE ERP_PDV_Master",
   porque em hospedagem compartilhada o nome do banco e definido pelo provedor.
   ============================================================================ */
GO

/* ===== database/estrutura.banco.ERP_v4.0.sql ===== */
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

GO

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

GO

/* ===== database/ERP_CORE_etapa1_v4.1.sql ===== */
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

GO

/* ===== database/ERP_CORE_etapa2_v4.2.sql ===== */
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

GO

/* ===== database/ERP_CORE_etapa3_v4.3.sql ===== */
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
GO

/* ===== analytics/01_funcoes_analiticas.sql ===== */
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
GO

/* ===== database/ERP_CORE_etapa4_v4.4.sql ===== */
/* ============================================================================
   ERP-CORE  -  ETAPA 4  (v4.4)   Migracao: NAO apaga dados.
   Rode UMA vez (pode rodar de novo sem problema) no banco ERP_PDV_Master,
   DEPOIS da v4.0, v4.1, v4.2 e v4.3 (e do script analytics).

   O QUE ENTRA  (seguranca e auditoria)
   - Usuarios: login, senha CRIPTOGRAFADA (hash feito no backend), perfil e situacao
   - Sessoes: tokens de login (guardados apenas como hash; expiram e podem ser revogados)
   - sp_SalvarUsuario / sp_AlterarSenha
   - Historico de estoque passa a registrar QUEM fez cada movimento:
     sp_SalvarProduto, sp_EntradaEstoque, sp_RegistrarVenda e sp_CancelarVenda
     ganharam o parametro opcional @usuario (se vier vazio, grava 'Sistema')
   - vw_AuditoriaEstoque: historico de estoque com o nome do produto

   PERFIS
     GERENTE   = tudo (dono / gerente)
     OPERADOR  = so PDV e abertura/fechamento do caixa (regras no backend)

   O primeiro usuario (admin) e criado pelo BACKEND na primeira vez que ele sobe,
   pois so o Node sabe gerar o hash da senha.

   CODIGOS DE ERRO NOVOS (THROW)
     50160-50167  usuarios e senhas
   Arquivo ASCII puro (sem acentos) de proposito.
   ============================================================================ */

SET NOCOUNT ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;
GO

GO

/* ============================================================================
   1. TABELAS
   ============================================================================ */

IF OBJECT_ID('dbo.Usuarios', 'U') IS NULL
CREATE TABLE dbo.Usuarios (
    id_usuario        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Usuarios PRIMARY KEY,
    nome              VARCHAR(100) NOT NULL,
    login             VARCHAR(50)  NOT NULL CONSTRAINT UQ_Usuarios_login UNIQUE,
    senha_hash        VARCHAR(200) NOT NULL,   -- scrypt$salt$hash (nunca a senha em texto)
    perfil            VARCHAR(10)  NOT NULL,
    ativo             BIT          NOT NULL CONSTRAINT DF_Usuarios_ativo DEFAULT 1,
    deve_trocar_senha BIT          NOT NULL CONSTRAINT DF_Usuarios_troca DEFAULT 0,
    data_cadastro     DATETIME2(0) NOT NULL CONSTRAINT DF_Usuarios_data  DEFAULT SYSDATETIME(),
    ultimo_acesso     DATETIME2(0) NULL,
    CONSTRAINT CK_Usuarios_perfil CHECK (perfil IN ('OPERADOR', 'GERENTE')),
    CONSTRAINT CK_Usuarios_nome   CHECK (LEN(LTRIM(RTRIM(nome))) > 0),
    CONSTRAINT CK_Usuarios_login  CHECK (LEN(login) >= 3 AND login NOT LIKE '%[^a-z0-9._-]%')
);
GO

IF OBJECT_ID('dbo.Sessoes', 'U') IS NULL
CREATE TABLE dbo.Sessoes (
    token_hash CHAR(64)     NOT NULL CONSTRAINT PK_Sessoes PRIMARY KEY,   -- SHA-256 do token
    id_usuario INT          NOT NULL CONSTRAINT FK_Sessoes_Usuarios REFERENCES dbo.Usuarios(id_usuario),
    criada_em  DATETIME2(0) NOT NULL CONSTRAINT DF_Sessoes_criada DEFAULT SYSDATETIME(),
    expira_em  DATETIME2(0) NOT NULL
);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Sessoes_usuario' AND object_id = OBJECT_ID('dbo.Sessoes'))
    CREATE INDEX IX_Sessoes_usuario ON dbo.Sessoes(id_usuario);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Sessoes_expira' AND object_id = OBJECT_ID('dbo.Sessoes'))
    CREATE INDEX IX_Sessoes_expira ON dbo.Sessoes(expira_em);
GO

/* ============================================================================
   2. PROCEDURES DE USUARIO
   ============================================================================ */

-- Criar ou editar usuario. @id_usuario NULL = novo (senha obrigatoria).
-- Em edicao, @senha_hash NULL mantem a senha atual; com valor, redefine (e derruba as sessoes).
CREATE OR ALTER PROCEDURE dbo.sp_SalvarUsuario
    @id_usuario   INT = NULL,
    @nome         VARCHAR(100),
    @login        VARCHAR(50),
    @senha_hash   VARCHAR(200) = NULL,
    @perfil       VARCHAR(10),
    @ativo        BIT = 1,
    @forcar_troca BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @detalhes NVARCHAR(4000) = CONCAT(
        'id_usuario=', @id_usuario, '; login=', @login, '; perfil=', @perfil, '; ativo=', @ativo);

    BEGIN TRY
        SET @nome   = LTRIM(RTRIM(ISNULL(@nome, '')));
        SET @login  = LOWER(LTRIM(RTRIM(ISNULL(@login, ''))));
        SET @perfil = UPPER(LTRIM(RTRIM(ISNULL(@perfil, ''))));
        SET @ativo  = ISNULL(@ativo, 1);
        SET @forcar_troca = ISNULL(@forcar_troca, 0);

        IF @nome = ''
            THROW 50160, N'O nome e obrigatorio.', 1;
        IF LEN(@login) < 3 OR @login LIKE '%[^a-z0-9._-]%'
            THROW 50161, N'Login invalido. Use 3 ou mais letras minusculas, numeros, ponto, hifen ou sublinhado.', 1;
        IF @perfil NOT IN ('OPERADOR', 'GERENTE')
            THROW 50162, N'Perfil invalido. Use OPERADOR ou GERENTE.', 1;
        IF EXISTS (SELECT 1 FROM dbo.Usuarios
                   WHERE login = @login AND (@id_usuario IS NULL OR id_usuario <> @id_usuario))
            THROW 50163, N'Ja existe um usuario com este login.', 1;

        IF @id_usuario IS NULL
        BEGIN
            IF @senha_hash IS NULL OR LEN(@senha_hash) < 20
                THROW 50164, N'A senha e obrigatoria para um novo usuario.', 1;

            INSERT INTO dbo.Usuarios (nome, login, senha_hash, perfil, ativo, deve_trocar_senha)
            VALUES (@nome, @login, @senha_hash, @perfil, @ativo, @forcar_troca);
            SET @id_usuario = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE id_usuario = @id_usuario)
                THROW 50165, N'Usuario nao encontrado.', 1;

            -- o sistema nunca pode ficar sem um gerente ativo
            IF (@perfil <> 'GERENTE' OR @ativo = 0)
               AND EXISTS (SELECT 1 FROM dbo.Usuarios WHERE id_usuario = @id_usuario AND perfil = 'GERENTE' AND ativo = 1)
               AND NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE id_usuario <> @id_usuario AND perfil = 'GERENTE' AND ativo = 1)
                THROW 50166, N'O sistema precisa de pelo menos um gerente ativo.', 1;

            IF @propria = 1 BEGIN TRANSACTION;

            UPDATE dbo.Usuarios
            SET nome  = @nome,
                login = @login,
                perfil = @perfil,
                ativo = @ativo,
                senha_hash = ISNULL(@senha_hash, senha_hash),
                deve_trocar_senha = CASE WHEN @senha_hash IS NOT NULL THEN @forcar_troca ELSE deve_trocar_senha END
            WHERE id_usuario = @id_usuario;

            -- desativou ou redefiniu a senha: derruba as sessoes abertas desse usuario
            IF @ativo = 0 OR @senha_hash IS NOT NULL
                DELETE FROM dbo.Sessoes WHERE id_usuario = @id_usuario;

            IF @propria = 1 COMMIT TRANSACTION;
        END

        SELECT @id_usuario AS id_usuario;
    END TRY
    BEGIN CATCH
        IF @propria = 1 AND XACT_STATE() <> 0 ROLLBACK TRANSACTION;
        IF @propria = 1 EXEC dbo.sp_RegistrarErro @detalhes = @detalhes;
        THROW;
    END CATCH
END
GO

-- Troca de senha pelo proprio usuario. Derruba as outras sessoes (menos a atual, @manter_token).
CREATE OR ALTER PROCEDURE dbo.sp_AlterarSenha
    @id_usuario    INT,
    @senha_hash    VARCHAR(200),
    @manter_token  CHAR(64) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    DECLARE @propria BIT = IIF(@@TRANCOUNT = 0, 1, 0);
    DECLARE @detalhes NVARCHAR(4000) = CONCAT('id_usuario=', @id_usuario);

    BEGIN TRY
        IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE id_usuario = @id_usuario AND ativo = 1)
            THROW 50167, N'Usuario nao encontrado.', 1;
        IF @senha_hash IS NULL OR LEN(@senha_hash) < 20
            THROW 50164, N'Senha invalida.', 1;

        IF @propria = 1 BEGIN TRANSACTION;

        UPDATE dbo.Usuarios SET senha_hash = @senha_hash, deve_trocar_senha = 0 WHERE id_usuario = @id_usuario;
        DELETE FROM dbo.Sessoes
        WHERE id_usuario = @id_usuario AND (@manter_token IS NULL OR token_hash <> @manter_token);

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
   3. PROCEDURES COM AUDITORIA (iguais as anteriores + parametro @usuario)
   ============================================================================ */

CREATE OR ALTER PROCEDURE dbo.sp_SalvarProduto
    @nome            VARCHAR(100),
    @preco_custo     DECIMAL(10,2),
    @preco_venda     DECIMAL(10,2),
    @estoque_inicial INT,
    @estoque_minimo  INT = 5,
    @codigo_barras   VARCHAR(13)  = NULL,
    @nome_categoria  VARCHAR(100) = NULL,
    @nome_marca      VARCHAR(100) = NULL,
    @usuario VARCHAR(50) = NULL
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
            (id_produto, tipo_movimento, quantidade, estoque_resultante, motivo, usuario_responsavel)
        SELECT @id_novo, 'ENTRADA', @estoque_inicial, @estoque_inicial, 'Cadastro inicial', ISNULL(@usuario, 'Sistema')
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

CREATE OR ALTER PROCEDURE dbo.sp_EntradaEstoque
    @id_produto INT,
    @quantidade INT,
    @motivo     VARCHAR(100) = 'Entrada de mercadoria',
    @usuario VARCHAR(50) = NULL
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
            (id_produto, tipo_movimento, quantidade, estoque_resultante, motivo, usuario_responsavel)
        VALUES (@id_produto, 'ENTRADA', @quantidade, @novo_estoque, @motivo, ISNULL(@usuario, 'Sistema'));

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

CREATE OR ALTER PROCEDURE dbo.sp_RegistrarVenda
    @id_caixa        INT,
    @valor_desconto  DECIMAL(10,2) = 0,
    @itens_json      NVARCHAR(MAX),
    @pagamentos_json NVARCHAR(MAX),
    @id_venda        INT = NULL OUTPUT,
    @id_cliente      INT = NULL,
    @id_orcamento    INT = NULL,
    @usuario VARCHAR(50) = NULL
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
            (id_produto, tipo_movimento, quantidade, estoque_resultante, motivo, id_venda, usuario_responsavel)
        SELECT p.id_produto, 'SAIDA', c.qtd, p.estoque_atual,
               CONCAT('Venda ID: ', @id_venda,
                      CASE WHEN EXISTS (SELECT 1 FROM @linhas l WHERE l.id_produto = c.id_produto AND l.tem_ficha = 0)
                           THEN '' ELSE ' (ficha tecnica)' END),
               @id_venda, ISNULL(@usuario, 'Sistema')
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

CREATE OR ALTER PROCEDURE dbo.sp_CancelarVenda
    @id_venda INT,
    @motivo   VARCHAR(200) = NULL,
    @usuario VARCHAR(50) = NULL
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
            (id_produto, tipo_movimento, quantidade, estoque_resultante, motivo, id_venda, usuario_responsavel)
        SELECT D.id_produto, 'ENTRADA', D.qtd, P.estoque_atual,
               LEFT(CONCAT('Estorno venda ID: ', @id_venda,
                           CASE WHEN @motivo IS NULL THEN '' ELSE CONCAT(' - ', @motivo) END), 100),
               @id_venda, ISNULL(@usuario, 'Sistema')
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

/* ============================================================================
   4. VIEW DE AUDITORIA
   ============================================================================ */

CREATE OR ALTER VIEW dbo.vw_AuditoriaEstoque AS
SELECT H.id_movimento,
       H.data_movimento,
       H.id_produto,
       P.nome AS produto,
       H.tipo_movimento,
       H.quantidade,
       H.estoque_resultante,
       H.motivo,
       H.usuario_responsavel,
       H.id_venda
FROM dbo.Historico_Movimentacao_Estoque H
JOIN dbo.Produtos P ON P.id_produto = H.id_produto;
GO

PRINT '=== ERP-CORE etapa 4 (v4.4) instalada com sucesso ===';
GO

/* TESTE RAPIDO (rode separado, depois de subir o backend uma vez)
   SELECT id_usuario, nome, login, perfil, ativo, deve_trocar_senha FROM Usuarios;   -- deve existir o 'admin'
   SELECT TOP 20 * FROM vw_AuditoriaEstoque ORDER BY id_movimento DESC;
   SELECT * FROM vw_ErrosRecentes;
*/
GO
