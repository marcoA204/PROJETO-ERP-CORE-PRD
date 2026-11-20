const { connectToDatabase, sql } = require('../config/db');
const { responderErro } = require('../utils/erroHttp');
const { gerarPixCopiaECola } = require('../utils/pix');

function lerId(req, res) {
    const id = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
        res.status(400).json({ erro: "Número de venda inválido." });
        return null;
    }
    return id;
}

// Usa a procedure sp_RegistrarVenda (v4.0): a venda inteira em UMA chamada e UMA transação.
async function registrarVenda(req, res) {
    try {
        const { id_caixa, valor_desconto, itens, pagamentos, id_cliente, id_orcamento } = req.body;
        const pool = await connectToDatabase();

        const result = await pool.request()
            .input('id_caixa', sql.Int, id_caixa)
            .input('valor_desconto', sql.Decimal(10, 2), valor_desconto || 0)
            .input('itens_json', sql.NVarChar(sql.MAX), JSON.stringify(itens || []))
            .input('pagamentos_json', sql.NVarChar(sql.MAX), JSON.stringify(pagamentos || []))
            .input('id_cliente', sql.Int, id_cliente || null)
            .input('id_orcamento', sql.Int, id_orcamento || null)
            .input('usuario', sql.VarChar(50), req.usuario ? req.usuario.login : null)
            .output('id_venda', sql.Int)
            .execute('sp_RegistrarVenda');

        res.status(201).json({ mensagem: "Venda registrada com sucesso!", id_venda: result.output.id_venda });
    } catch (erro) {
        console.error("Erro ao registrar venda:", erro);
        responderErro(res, erro, "Falha ao registrar a venda.");
    }
}

// GET /api/vendas?limite=100  -> histórico (mais recentes primeiro)
async function listarVendas(req, res) {
    try {
        const limite = Math.min(Math.max(Number.parseInt(req.query.limite, 10) || 100, 1), 300);
        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('limite', sql.Int, limite)
            .query(`
                SELECT TOP (@limite)
                       id_venda,
                       CONVERT(CHAR(10), data_venda, 103) + ' ' + CONVERT(CHAR(5), data_venda, 108) AS data_venda,
                       turno, valor_total, valor_desconto, valor_a_receber,
                       status_venda, motivo_cancelamento, qtd_itens, cliente_nome
                FROM dbo.vw_HistoricoVendas
                ORDER BY id_venda DESC
            `);
        res.json(result.recordset);
    } catch (erro) {
        console.error("Erro ao listar vendas:", erro);
        res.status(500).json({ erro: "Falha ao carregar o histórico de vendas." });
    }
}

// POST /api/vendas/:id/cancelar  { motivo }
async function cancelarVenda(req, res) {
    try {
        const id = lerId(req, res);
        if (id === null) return;
        const pool = await connectToDatabase();

        await pool.request()
            .input('id_venda', sql.Int, id)
            .input('motivo', sql.VarChar(200), String(req.body.motivo || '').trim().slice(0, 200) || null)
            .input('usuario', sql.VarChar(50), req.usuario ? req.usuario.login : null)
            .execute('sp_CancelarVenda');

        res.json({ mensagem: "Venda cancelada e itens devolvidos ao estoque." });
    } catch (erro) {
        console.error("Erro ao cancelar venda:", erro);
        responderErro(res, erro, "Falha ao cancelar a venda.");
    }
}

// GET /api/vendas/:id/recibo -> itens, pagamentos, total e Pix (valor = soma dos pagamentos em Pix)
async function obterRecibo(req, res) {
    try {
        const id = lerId(req, res);
        if (id === null) return;

        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('id_venda', sql.Int, id)
            .query(`
                SELECT V.id_venda,
                       CONVERT(CHAR(10), V.data_venda, 103) + ' ' + CONVERT(CHAR(5), V.data_venda, 108) AS data_venda,
                       V.valor_total, V.valor_desconto,
                       (V.valor_total - V.valor_desconto) AS valor_a_receber,
                       V.status_venda, V.motivo_cancelamento,
                       C.nome AS cliente_nome, C.whatsapp AS cliente_whatsapp
                FROM dbo.Vendas V
                LEFT JOIN dbo.Clientes C ON C.id_cliente = V.id_cliente
                WHERE V.id_venda = @id_venda;

                SELECT P.nome AS produto, I.quantidade,
                       I.preco_unitario_praticado AS preco_unitario, I.subtotal
                FROM dbo.ItensVenda I
                JOIN dbo.Produtos P ON P.id_produto = I.id_produto
                WHERE I.id_venda = @id_venda
                ORDER BY I.id_item;

                SELECT forma_pagamento, valor_pago
                FROM dbo.PagamentosVenda
                WHERE id_venda = @id_venda
                ORDER BY id_pagamento;
            `);

        const venda = result.recordsets[0][0];
        if (!venda) {
            return res.status(404).json({ erro: "Venda não encontrada." });
        }
        const pagamentos = result.recordsets[2];

        const valorPix = pagamentos
            .filter(p => p.forma_pagamento === 'PIX')
            .reduce((soma, p) => soma + Number(p.valor_pago), 0);
        const temPix = valorPix > 0;

        let pix = null;
        if (temPix && venda.status_venda === 'CONCLUIDA' && process.env.PIX_CHAVE) {
            const txid = `VENDA${venda.id_venda}`;
            pix = {
                txid,
                payload: gerarPixCopiaECola({
                    chave: process.env.PIX_CHAVE,
                    nome: process.env.PIX_NOME || process.env.LOJA_NOME,
                    cidade: process.env.PIX_CIDADE,
                    valor: valorPix,
                    txid
                })
            };
        }

        res.json({
            loja: process.env.LOJA_NOME || 'ERP-CORE',
            cliente: venda.cliente_nome ? { nome: venda.cliente_nome, whatsapp: venda.cliente_whatsapp } : null,
            venda,
            itens: result.recordsets[1],
            pagamentos,
            tem_pix: temPix,
            valor_pix: valorPix,
            pix,
            pix_configurado: Boolean(process.env.PIX_CHAVE)
        });
    } catch (erro) {
        console.error("Erro ao montar o recibo:", erro);
        res.status(500).json({ erro: "Falha ao montar o recibo da venda." });
    }
}

module.exports = { registrarVenda, listarVendas, cancelarVenda, obterRecibo };