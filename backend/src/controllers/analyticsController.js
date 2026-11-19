const { connectToDatabase, sql } = require('../config/db');

// Janela de tempo em dias (1 a 730). Valor inválido volta para o padrão.
function lerDias(req, padrao) {
    const d = Number.parseInt(req.query.dias, 10);
    return Number.isInteger(d) && d >= 1 && d <= 730 ? d : padrao;
}

// GET /api/analytics/curva-abc?dias=90
async function curvaAbc(req, res) {
    try {
        const dias = lerDias(req, 90);
        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('dias', sql.Int, dias)
            .query(`SELECT * FROM dbo.fn_CurvaABC(@dias) ORDER BY lucro DESC, produto`);
        res.json(result.recordset);
    } catch (erro) {
        console.error("Erro na Curva ABC:", erro);
        res.status(500).json({ erro: "Falha ao calcular a Curva ABC. O script analytics/01_funcoes_analiticas.sql foi executado?" });
    }
}

// GET /api/analytics/estoque-parado?dias=30
async function estoqueParado(req, res) {
    try {
        const dias = lerDias(req, 30);
        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('dias', sql.Int, dias)
            .query(`
                SELECT id_produto, produto, estoque_atual, preco_custo, capital_parado,
                       CONVERT(CHAR(10), ultima_saida, 103) AS ultima_saida, dias_parado
                FROM dbo.fn_EstoqueParado(@dias)
                ORDER BY capital_parado DESC, produto
            `);
        res.json(result.recordset);
    } catch (erro) {
        console.error("Erro no estoque parado:", erro);
        res.status(500).json({ erro: "Falha ao calcular o estoque parado. O script analytics/01_funcoes_analiticas.sql foi executado?" });
    }
}

// GET /api/analytics/picos?dias=90
async function picos(req, res) {
    try {
        const dias = lerDias(req, 90);
        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('dias', sql.Int, dias)
            .query(`SELECT dia_semana_num, hora, qtd_vendas, faturamento FROM dbo.fn_PicoVendas(@dias) ORDER BY dia_semana_num, hora`);
        res.json(result.recordset);
    } catch (erro) {
        console.error("Erro nos horários de pico:", erro);
        res.status(500).json({ erro: "Falha ao calcular os horários de pico. O script analytics/01_funcoes_analiticas.sql foi executado?" });
    }
}

module.exports = { curvaAbc, estoqueParado, picos };