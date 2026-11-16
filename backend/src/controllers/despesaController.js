const { connectToDatabase, sql } = require('../config/db');
const { responderErro } = require('../utils/erroHttp');

// GET /api/despesas  -> contas a pagar e pagas (pendentes primeiro, por vencimento)
async function listarDespesas(req, res) {
    try {
        const pool = await connectToDatabase();
        const result = await pool.request().query(`
            SELECT TOP 300 id_despesa, descricao,
                   CONVERT(CHAR(10), data_vencimento, 103) AS vencimento,
                   CONVERT(CHAR(10), data_pagamento, 103)  AS pagamento,
                   valor_total, status_pagamento, situacao, dias_para_vencer
            FROM dbo.vw_ContasPagar
            ORDER BY CASE WHEN status_pagamento = 'PENDENTE' THEN 0 ELSE 1 END,
                     CASE WHEN status_pagamento = 'PENDENTE' THEN data_vencimento END,
                     data_pagamento DESC, id_despesa DESC
        `);
        res.json(result.recordset);
    } catch (erro) {
        console.error("Erro ao listar despesas:", erro);
        res.status(500).json({ erro: "Falha ao carregar as contas a pagar." });
    }
}

// POST /api/despesas
//   { descricao, valor_total, data_vencimento?: "AAAA-MM-DD", pago?: true|false }
//   pago omitido = true (despesa paga na hora, como no Fluxo de Caixa)
async function registrarDespesa(req, res) {
    try {
        const { descricao, valor_total, data_vencimento } = req.body;
        const pago = req.body.pago === undefined ? true : Boolean(req.body.pago);

        if (data_vencimento && !/^\d{4}-\d{2}-\d{2}$/.test(String(data_vencimento))) {
            return res.status(400).json({ erro: "Data de vencimento inválida." });
        }

        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('descricao', sql.VarChar(100), String(descricao || '').trim().slice(0, 100))
            .input('valor_total', sql.Decimal(10, 2), Number(valor_total))
            .input('data_vencimento', sql.VarChar(10), data_vencimento || null)
            .input('pago', sql.Bit, pago)
            .output('id_despesa', sql.Int)
            .execute('sp_LancarDespesa');

        res.status(201).json({
            mensagem: pago ? "Despesa registrada como paga!" : "Conta lançada!",
            id_despesa: result.output.id_despesa
        });
    } catch (erro) {
        console.error("Erro ao registrar despesa:", erro);
        responderErro(res, erro, "Falha ao registrar a despesa.");
    }
}

// POST /api/despesas/:id/pagar  -> dar baixa
async function pagarDespesa(req, res) {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ erro: "Conta inválida." });
        }
        const pool = await connectToDatabase();
        await pool.request()
            .input('id_despesa', sql.Int, id)
            .execute('sp_PagarDespesa');

        res.json({ mensagem: "Conta paga!" });
    } catch (erro) {
        console.error("Erro ao pagar despesa:", erro);
        responderErro(res, erro, "Falha ao dar baixa na conta.");
    }
}

module.exports = { listarDespesas, registrarDespesa, pagarDespesa };
