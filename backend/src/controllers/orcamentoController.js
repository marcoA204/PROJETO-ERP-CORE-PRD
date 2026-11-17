const { connectToDatabase, sql } = require('../config/db');
const { responderErro } = require('../utils/erroHttp');

function lerId(req, res) {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ erro: "Orçamento inválido." });
        return null;
    }
    return id;
}

// GET /api/orcamentos  -> últimos 200
async function listarOrcamentos(req, res) {
    try {
        const pool = await connectToDatabase();
        const result = await pool.request().query(`
            SELECT TOP 200 id_orcamento,
                   CONVERT(CHAR(10), data_criacao, 103) AS data,
                   CONVERT(CHAR(10), validade, 103)     AS validade,
                   situacao, cliente_nome, valor_a_receber, id_venda
            FROM dbo.vw_Orcamentos
            ORDER BY id_orcamento DESC
        `);
        res.json(result.recordset);
    } catch (erro) {
        console.error("Erro ao listar orçamentos:", erro);
        res.status(500).json({ erro: "Falha ao carregar os orçamentos." });
    }
}

// GET /api/orcamentos/:id  -> cabeçalho + itens (usado no WhatsApp e para levar ao PDV)
async function obterOrcamento(req, res) {
    try {
        const id = lerId(req, res);
        if (id === null) return;
        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query(`
                SELECT id_orcamento,
                       CONVERT(CHAR(10), data_criacao, 103) AS data,
                       CONVERT(CHAR(10), validade, 103)     AS validade,
                       situacao, id_cliente, cliente_nome, cliente_whatsapp,
                       valor_total, valor_desconto, valor_a_receber, id_venda, observacoes
                FROM dbo.vw_Orcamentos
                WHERE id_orcamento = @id;

                SELECT P.nome AS produto, P.codigo_barras, I.quantidade, I.preco_unitario,
                       (I.quantidade * I.preco_unitario) AS subtotal
                FROM dbo.ItensOrcamento I
                JOIN dbo.Produtos P ON P.id_produto = I.id_produto
                WHERE I.id_orcamento = @id
                ORDER BY I.id_item;
            `);

        const orcamento = result.recordsets[0][0];
        if (!orcamento) return res.status(404).json({ erro: "Orçamento não encontrado." });

        res.json({ loja: process.env.LOJA_NOME || 'ERP-CORE', orcamento, itens: result.recordsets[1] });
    } catch (erro) {
        console.error("Erro ao buscar orçamento:", erro);
        res.status(500).json({ erro: "Falha ao carregar o orçamento." });
    }
}

// POST /api/orcamentos
//   { id_cliente?, validade?: "AAAA-MM-DD", valor_desconto?, observacoes?, itens: [{ codigo_barras, quantidade }] }
async function criarOrcamento(req, res) {
    try {
        const { id_cliente, validade, valor_desconto, observacoes, itens } = req.body;
        if (validade && !/^\d{4}-\d{2}-\d{2}$/.test(String(validade))) {
            return res.status(400).json({ erro: "Data de validade inválida." });
        }
        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('id_cliente', sql.Int, id_cliente || null)
            .input('validade', sql.VarChar(10), validade || null)
            .input('valor_desconto', sql.Decimal(10, 2), valor_desconto || 0)
            .input('observacoes', sql.VarChar(300), String(observacoes || '').trim().slice(0, 300) || null)
            .input('itens_json', sql.NVarChar(sql.MAX), JSON.stringify(itens || []))
            .output('id_orcamento', sql.Int)
            .execute('sp_CriarOrcamento');

        res.status(201).json({ mensagem: "Orçamento criado!", id_orcamento: result.output.id_orcamento });
    } catch (erro) {
        console.error("Erro ao criar orçamento:", erro);
        responderErro(res, erro, "Falha ao criar o orçamento.");
    }
}

// POST /api/orcamentos/:id/cancelar
async function cancelarOrcamento(req, res) {
    try {
        const id = lerId(req, res);
        if (id === null) return;
        const pool = await connectToDatabase();
        await pool.request().input('id_orcamento', sql.Int, id).execute('sp_CancelarOrcamento');
        res.json({ mensagem: "Orçamento cancelado." });
    } catch (erro) {
        console.error("Erro ao cancelar orçamento:", erro);
        responderErro(res, erro, "Falha ao cancelar o orçamento.");
    }
}

module.exports = { listarOrcamentos, obterOrcamento, criarOrcamento, cancelarOrcamento };