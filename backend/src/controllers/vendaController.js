const { connectToDatabase, sql } = require('../config/db');
const { responderErro } = require('../utils/erroHttp');
const { gerarPixCopiaECola } = require('../utils/pix');

// Usa a procedure sp_RegistrarVenda (v4.0): a venda inteira em UMA chamada e UMA transação.
// Se qualquer passo falhar, nada é gravado e o motivo vai para a tabela Log_Erros.
async function registrarVenda(req, res) {
    try {
        const { id_caixa, valor_desconto, itens, pagamentos } = req.body;
        const pool = await connectToDatabase();

        const result = await pool.request()
            .input('id_caixa', sql.Int, id_caixa)
            .input('valor_desconto', sql.Decimal(10, 2), valor_desconto || 0)
            .input('itens_json', sql.NVarChar(sql.MAX), JSON.stringify(itens || []))
            .input('pagamentos_json', sql.NVarChar(sql.MAX), JSON.stringify(pagamentos || []))
            .output('id_venda', sql.Int)
            .execute('sp_RegistrarVenda');

        res.status(201).json({ mensagem: "Venda registrada com sucesso!", id_venda: result.output.id_venda });
    } catch (erro) {
        console.error("Erro ao registrar venda:", erro);
        responderErro(res, erro, "Falha ao registrar a venda.");
    }
}

// Recibo de uma venda: itens, total e (se configurado) o Pix Copia e Cola com o valor exato.
// Tudo vem do banco, nada é digitado pelo navegador.
async function obterRecibo(req, res) {
    try {
        const id = Number.parseInt(req.params.id, 10);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ erro: "Número de venda inválido." });
        }

        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('id_venda', sql.Int, id)
            .query(`
                SELECT V.id_venda,
                       CONVERT(CHAR(10), V.data_venda, 103) + ' ' + CONVERT(CHAR(5), V.data_venda, 108) AS data_venda,
                       V.valor_total,
                       V.valor_desconto,
                       (V.valor_total - V.valor_desconto) AS valor_a_receber,
                       V.status_venda
                FROM dbo.Vendas V
                WHERE V.id_venda = @id_venda;

                SELECT P.nome AS produto, I.quantidade,
                       I.preco_unitario_praticado AS preco_unitario, I.subtotal
                FROM dbo.ItensVenda I
                JOIN dbo.Produtos P ON P.id_produto = I.id_produto
                WHERE I.id_venda = @id_venda
                ORDER BY I.id_item;
            `);

        const venda = result.recordsets[0][0];
        if (!venda) {
            return res.status(404).json({ erro: "Venda não encontrada." });
        }

        // Pix: só gera se a chave estiver no .env do backend
        let pix = null;
        if (process.env.PIX_CHAVE && venda.valor_a_receber > 0) {
            const txid = `VENDA${venda.id_venda}`;
            pix = {
                txid,
                payload: gerarPixCopiaECola({
                    chave: process.env.PIX_CHAVE,
                    nome: process.env.PIX_NOME || process.env.LOJA_NOME,
                    cidade: process.env.PIX_CIDADE,
                    valor: venda.valor_a_receber,
                    txid
                })
            };
        }

        res.json({
            loja: process.env.LOJA_NOME || 'ERP-CORE',
            venda,
            itens: result.recordsets[1],
            pix,
            pix_configurado: Boolean(process.env.PIX_CHAVE)
        });
    } catch (erro) {
        console.error("Erro ao montar o recibo:", erro);
        res.status(500).json({ erro: "Falha ao montar o recibo da venda." });
    }
}

module.exports = { registrarVenda, obterRecibo };
