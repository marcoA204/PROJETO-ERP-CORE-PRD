const { connectToDatabase, sql } = require('../config/db');
const { responderErro } = require('../utils/erroHttp');

// GET /api/taxas  -> taxa (%) de cada forma de pagamento
async function listarTaxas(req, res) {
    try {
        const pool = await connectToDatabase();
        const result = await pool.request().query(
            `SELECT forma_pagamento, taxa_percentual FROM dbo.TaxasPagamento ORDER BY forma_pagamento`
        );
        res.json(result.recordset);
    } catch (erro) {
        console.error("Erro ao listar taxas:", erro);
        res.status(500).json({ erro: "Falha ao carregar as taxas." });
    }
}

// PUT /api/taxas  { taxas: [{ forma_pagamento, taxa_percentual }] }
async function salvarTaxas(req, res) {
    try {
        const { taxas } = req.body;
        if (!Array.isArray(taxas) || taxas.length === 0) {
            return res.status(400).json({ erro: "Envie a lista de taxas." });
        }
        const pool = await connectToDatabase();
        await pool.request()
            .input('taxas_json', sql.NVarChar(sql.MAX), JSON.stringify(taxas))
            .execute('sp_SalvarTaxas');

        res.json({ mensagem: "Taxas salvas! Valem para as vendas feitas daqui para frente." });
    } catch (erro) {
        console.error("Erro ao salvar taxas:", erro);
        responderErro(res, erro, "Falha ao salvar as taxas.");
    }
}

module.exports = { listarTaxas, salvarTaxas };