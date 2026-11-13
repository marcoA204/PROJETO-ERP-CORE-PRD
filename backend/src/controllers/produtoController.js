const { connectToDatabase, sql } = require('../config/db');

async function listarProdutos(req, res) {
    try {
        const pool = await connectToDatabase();

        // Executa a consulta chamando a View que já existe no seu banco de dados
        const resultado = await pool.request().query('SELECT * FROM vw_CatalogoProdutos');

        // Devolve os dados para o frontend em formato JSON
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
        .input('preco_custo', sql.Decimal(10,2), preco_custo)
        .input('preco_venda', sql.Decimal(10,2), preco_venda)
        .input('estoque_inicial', sql.Int, estoque_inicial)
        .input('estoque_minimo', sql.Int, estoque_minimo)
        .input('codigo_barras', sql.VarChar(13), codigo_barras || null)
        .input('nome_categoria', sql.VarChar(100), nome_categoria || null)
        .input('nome_marca', sql.VarChar(100), nome_marca || null)
        .execute('sp_SalvarProduto');

        res.status(201).json({ mensagem: `Produto '${nome}' cadastrado com Sucesso!` });
    } catch (erro) {
        console.error("Erro ao cadastrar produto:", erro);
        res.status(500).json({ erro: "Falha ao cadastrar o produto no banco." });
    }
}

module.exports = { listarProdutos, cadastrarProduto };
