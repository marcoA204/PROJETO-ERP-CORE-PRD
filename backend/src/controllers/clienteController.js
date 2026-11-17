const { connectToDatabase, sql } = require('../config/db');
const { responderErro } = require('../utils/erroHttp');

const soNumeros = (texto) => String(texto || '').replace(/\D/g, '');

function lerId(req, res) {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ erro: "Cliente inválido." });
        return null;
    }
    return id;
}

// GET /api/clientes  -> clientes ativos com total gasto e nº de compras
async function listarClientes(req, res) {
    try {
        const pool = await connectToDatabase();
        const result = await pool.request().query(`
            SELECT C.id_cliente, C.nome, C.whatsapp, C.documento, C.observacoes,
                   (SELECT COUNT(*) FROM dbo.Vendas V
                     WHERE V.id_cliente = C.id_cliente AND V.status_venda = 'CONCLUIDA') AS qtd_compras,
                   ISNULL((SELECT SUM(V.valor_total - V.valor_desconto) FROM dbo.Vendas V
                            WHERE V.id_cliente = C.id_cliente AND V.status_venda = 'CONCLUIDA'), 0) AS total_gasto
            FROM dbo.Clientes C
            WHERE C.ativo = 1
            ORDER BY C.nome
        `);
        res.json(result.recordset);
    } catch (erro) {
        console.error("Erro ao listar clientes:", erro);
        res.status(500).json({ erro: "Falha ao carregar os clientes." });
    }
}

// POST /api/clientes (novo)  |  PUT /api/clientes/:id (editar)
async function salvarCliente(req, res) {
    try {
        let id = null;
        if (req.params.id !== undefined) {
            id = lerId(req, res);
            if (id === null) return;
        }
        const { nome, whatsapp, documento, observacoes } = req.body;
        const pool = await connectToDatabase();

        const result = await pool.request()
            .input('id_cliente', sql.Int, id)
            .input('nome', sql.VarChar(100), String(nome || '').trim())
            .input('whatsapp', sql.VarChar(20), soNumeros(whatsapp) || null)
            .input('documento', sql.VarChar(20), soNumeros(documento) || null)
            .input('observacoes', sql.VarChar(300), String(observacoes || '').trim() || null)
            .execute('sp_SalvarCliente');

        const salvo = result.recordset[0] || {};
        res.status(id ? 200 : 201).json({ mensagem: id ? "Cliente atualizado!" : "Cliente cadastrado!", id_cliente: salvo.id_cliente });
    } catch (erro) {
        console.error("Erro ao salvar cliente:", erro);
        responderErro(res, erro, "Falha ao salvar o cliente.");
    }
}

// DELETE /api/clientes/:id  -> inativa (o histórico de compras continua)
async function inativarCliente(req, res) {
    try {
        const id = lerId(req, res);
        if (id === null) return;
        const pool = await connectToDatabase();
        await pool.request().input('id_cliente', sql.Int, id).execute('sp_InativarCliente');
        res.json({ mensagem: "Cliente removido da lista." });
    } catch (erro) {
        console.error("Erro ao inativar cliente:", erro);
        responderErro(res, erro, "Falha ao remover o cliente.");
    }
}

// GET /api/clientes/:id/historico  -> resumo + últimas 30 compras
async function historicoCliente(req, res) {
    try {
        const id = lerId(req, res);
        if (id === null) return;
        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT COUNT(*) AS qtd_compras,
                       ISNULL(SUM(valor_a_receber), 0) AS total_gasto,
                       CONVERT(CHAR(10), MAX(data_venda), 103) AS ultima_compra
                FROM dbo.vw_HistoricoVendas
                WHERE id_cliente = @id AND status_venda = 'CONCLUIDA';

                SELECT TOP 30 id_venda,
                       CONVERT(CHAR(10), data_venda, 103) + ' ' + CONVERT(CHAR(5), data_venda, 108) AS data_venda,
                       valor_a_receber, status_venda, qtd_itens
                FROM dbo.vw_HistoricoVendas
                WHERE id_cliente = @id
                ORDER BY id_venda DESC;
            `);
        res.json({ resumo: result.recordsets[0][0], vendas: result.recordsets[1] });
    } catch (erro) {
        console.error("Erro ao buscar histórico do cliente:", erro);
        res.status(500).json({ erro: "Falha ao carregar o histórico do cliente." });
    }
}

module.exports = { listarClientes, salvarCliente, inativarCliente, historicoCliente };
