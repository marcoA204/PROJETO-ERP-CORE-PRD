const { connectToDatabase, sql } = require('../config/db');

async function registrarDespesa(req, res) {
    try {
        const { descricao, valor_total } = req.body;
        const texto = String(descricao || '').trim();
        const valor = Number(valor_total);

        if (!texto) {
            return res.status(400).json({ erro: "Informe a descrição da despesa (campo Observação)." });
        }
        if (!Number.isFinite(valor) || valor <= 0) {
            return res.status(400).json({ erro: "O valor da despesa deve ser maior que zero." });
        }

        const pool = await connectToDatabase();
        await pool.request()
            .input('descricao', sql.VarChar(100), texto.slice(0, 100))
            .input('valor_total', sql.Decimal(10, 2), valor)
            .query(`
                INSERT INTO Despesas (descricao, data_vencimento, valor_total, status_pagamento, data_pagamento)
                VALUES (@descricao, CAST(SYSDATETIME() AS DATE), @valor_total, 'PAGO', CAST(SYSDATETIME() AS DATE))
            `);

        res.status(201).json({ mensagem: "Despesa registrada com sucesso!" });
    } catch (erro) {
        console.error("Erro ao registrar despesa:", erro);
        res.status(500).json({ erro: "Falha ao registrar a despesa no banco." });
    }
}

module.exports = { registrarDespesa };
