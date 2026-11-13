const { connectToDatabase, sql } = require('../config/db');

async function registrarVenda(req, res) {
    try {
        // O React vai enviar o id do caixa, o desconto e as listas de itens e pagamentos
        const { id_caixa, valor_desconto, itens, pagamentos } = req.body;
        const pool = await connectToDatabase();
        const transaction = new sql.Transaction(pool);

        // Inicia a transação (se algo der erro no meio, o banco desfaz tudo automaticamente)
        await transaction.begin();
        try {
            // Passo 1: Cria a venda vazia e pega o ID gerado
            const requestVenda = new sql.Request(transaction);
            const insertVenda = await requestVenda
                .input('id_caixa', sql.Int, id_caixa)
                .input('valor_desconto', sql.Decimal(10, 2), valor_desconto || 0)
                .query('INSERT INTO Vendas (id_caixa, valor_desconto) OUTPUT inserted.id_venda VALUES (@id_caixa, @valor_desconto)');

            const idVenda = insertVenda.recordset[0].id_venda;

            // Passo 2: Roda a Stored Procedure para cada item (que já dá baixa no estoque)
            for (const item of itens) {
                const itemReq = new sql.Request(transaction);
                await itemReq
                    .input('id_venda', sql.Int, idVenda)
                    .input('codigo_barras', sql.VarChar(13), item.codigo_barras)
                    .input('quantidade', sql.Int, item.quantidade)
                    .execute('sp_RegistrarItemVenda');
            }

            // Passo 3: Salva as formas de pagamento (Pix, Dinheiro, etc)
            for (const pag of pagamentos) {
                const pagReq = new sql.Request(transaction);
                await pagReq
                    .input('id_venda', sql.Int, idVenda)
                    .input('forma_pagamento', sql.VarChar(50), pag.forma_pagamento)
                    .input('valor_pago', sql.Decimal(10, 2), pag.valor_pago)
                    .query('INSERT INTO PagamentosVenda (id_venda, forma_pagamento, valor_pago) VALUES (@id_venda, @forma_pagamento, @valor_pago)');
            }

            await transaction.commit();
            res.status(201).json({ mensagem: "Venda registrada com sucesso!", id_venda: idVenda });
        } catch (err) {
            try { await transaction.rollback(); } catch (_) { }
            throw err;
        }
    } catch (erro) {
        console.error("Erro ao registrar venda:", erro);
        res.status(500).json({ erro: "Falha ao registrar a venda." });
    }
}

module.exports = { registrarVenda };
