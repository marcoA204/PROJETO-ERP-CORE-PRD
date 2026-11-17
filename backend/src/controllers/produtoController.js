const { connectToDatabase, sql } = require('../config/db');
const { responderErro } = require('../utils/erroHttp');

function lerId(req, res) {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ erro: "Produto inválido." });
        return null;
    }
    return id;
}

async function listarProdutos(req, res) {
    try {
        const pool = await connectToDatabase();
        const resultado = await pool.request().query('SELECT * FROM vw_CatalogoProdutos');
        res.json(resultado.recordset);
    } catch (erro) {
        console.error("Erro ao buscar produtos:", erro);
        res.status(500).json({ erro: "Falha ao buscar produtos no banco de dados." });
    }
}

async function cadastrarProduto(req, res) {
    try {
        const { nome, preco_custo, preco_venda, estoque_inicial, estoque_minimo, codigo_barras, nome_categoria, nome_marca } = req.body;
        const pool = await connectToDatabase();

        await pool.request()
            .input('nome', sql.VarChar(100), nome)
            .input('preco_custo', sql.Decimal(10, 2), preco_custo)
            .input('preco_venda', sql.Decimal(10, 2), preco_venda)
            .input('estoque_inicial', sql.Int, estoque_inicial)
            .input('estoque_minimo', sql.Int, estoque_minimo)
            .input('codigo_barras', sql.VarChar(13), codigo_barras || null)
            .input('nome_categoria', sql.VarChar(100), nome_categoria || null)
            .input('nome_marca', sql.VarChar(100), nome_marca || null)
            .execute('sp_SalvarProduto');

        res.status(201).json({ mensagem: `Produto '${nome}' cadastrado com sucesso!` });
    } catch (erro) {
        console.error("Erro ao cadastrar produto:", erro);
        responderErro(res, erro, "Falha ao cadastrar o produto no banco.");
    }
}

// PUT /api/produtos/:id  -> edita nome, preços, mínimo e categoria
async function atualizarProduto(req, res) {
    try {
        const id = lerId(req, res);
        if (id === null) return;
        const { nome, preco_custo, preco_venda, estoque_minimo, nome_categoria } = req.body;
        const pool = await connectToDatabase();

        await pool.request()
            .input('id_produto', sql.Int, id)
            .input('nome', sql.VarChar(100), nome)
            .input('preco_custo', sql.Decimal(10, 2), preco_custo)
            .input('preco_venda', sql.Decimal(10, 2), preco_venda)
            .input('estoque_minimo', sql.Int, estoque_minimo)
            .input('nome_categoria', sql.VarChar(100), nome_categoria || null)
            .execute('sp_AtualizarProduto');

        res.json({ mensagem: "Produto atualizado com sucesso!" });
    } catch (erro) {
        console.error("Erro ao atualizar produto:", erro);
        responderErro(res, erro, "Falha ao atualizar o produto.");
    }
}

// POST /api/produtos/:id/entrada  -> reposição de estoque
async function entradaEstoque(req, res) {
    try {
        const id = lerId(req, res);
        if (id === null) return;
        const { quantidade, motivo } = req.body;
        if (!Number.isInteger(quantidade) || quantidade <= 0) {
            return res.status(400).json({ erro: "A quantidade deve ser um número inteiro maior que zero." });
        }
        const pool = await connectToDatabase();

        const result = await pool.request()
            .input('id_produto', sql.Int, id)
            .input('quantidade', sql.Int, quantidade)
            .input('motivo', sql.VarChar(100), String(motivo || '').trim() || 'Reposicao de estoque')
            .execute('sp_EntradaEstoque');

        res.json({ mensagem: "Entrada registrada!", ...(result.recordset[0] || {}) });
    } catch (erro) {
        console.error("Erro na entrada de estoque:", erro);
        responderErro(res, erro, "Falha ao registrar a entrada de estoque.");
    }
}

// DELETE /api/produtos/:id  -> INATIVA (não apaga; o histórico de vendas continua)
async function inativarProduto(req, res) {
    try {
        const id = lerId(req, res);
        if (id === null) return;
        const pool = await connectToDatabase();

        await pool.request()
            .input('id_produto', sql.Int, id)
            .execute('sp_InativarProduto');

        res.json({ mensagem: "Produto inativado." });
    } catch (erro) {
        console.error("Erro ao inativar produto:", erro);
        responderErro(res, erro, "Falha ao inativar o produto.");
    }
}

// GET /api/produtos/:id/ficha  -> ingredientes da receita do produto
async function obterFicha(req, res) {
    try {
        const id = lerId(req, res);
        if (id === null) return;
        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT F.id_ingrediente, P.nome, P.preco_custo, F.quantidade
                FROM dbo.FichaTecnica F
                JOIN dbo.Produtos P ON P.id_produto = F.id_ingrediente
                WHERE F.id_produto = @id
                ORDER BY P.nome
            `);
        res.json(result.recordset);
    } catch (erro) {
        console.error("Erro ao buscar ficha técnica:", erro);
        res.status(500).json({ erro: "Falha ao carregar a ficha técnica." });
    }
}

// PUT /api/produtos/:id/ficha  { ingredientes: [{ id_ingrediente, quantidade }] }  (lista vazia remove a ficha)
async function salvarFicha(req, res) {
    try {
        const id = lerId(req, res);
        if (id === null) return;
        const { ingredientes } = req.body;
        if (!Array.isArray(ingredientes)) {
            return res.status(400).json({ erro: "Envie a lista de ingredientes." });
        }
        const pool = await connectToDatabase();
        await pool.request()
            .input('id_produto', sql.Int, id)
            .input('ingredientes_json', sql.NVarChar(sql.MAX), JSON.stringify(ingredientes))
            .execute('sp_SalvarFichaTecnica');

        res.json({ mensagem: ingredientes.length ? "Ficha técnica salva!" : "Ficha técnica removida." });
    } catch (erro) {
        console.error("Erro ao salvar ficha técnica:", erro);
        responderErro(res, erro, "Falha ao salvar a ficha técnica.");
    }
}

module.exports = { listarProdutos, cadastrarProduto, atualizarProduto, entradaEstoque, inativarProduto, obterFicha, salvarFicha };