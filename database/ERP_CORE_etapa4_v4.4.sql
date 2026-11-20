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

USE ERP_PDV_Master;
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