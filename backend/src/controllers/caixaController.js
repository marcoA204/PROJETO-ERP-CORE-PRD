const { connectToDatabase, sql } = require('../config/db');
const { responderErro } = require('../utils/erroHttp');

// Abre o caixa usando a procedure v4.0 (só permite um caixa aberto por vez)
async function abrirCaixa(req, res) {
    try {
        const { troco_inicial } = req.body;
        const pool = await connectToDatabase();

        const result = await pool.request()
            .input('troco_inicial', sql.Decimal(10, 2), troco_inicial || 0)
            .output('id_caixa', sql.Int)
            .execute('sp_AbrirCaixa');

        res.status(201).json({ mensagem: "Caixa aberto com sucesso!", id_caixa: result.output.id_caixa });
    } catch (erro) {
        console.error("Erro ao abrir caixa:", erro);
        responderErro(res, erro, "Falha ao abrir caixa.");
    }
}

async function fecharCaixa(req, res) {
    try {
        const { id_caixa } = req.body;
        const pool = await connectToDatabase();

        const result = await pool.request()
            .input('id_caixa', sql.Int, id_caixa)
            .execute('sp_FecharCaixa');

        res.json({ mensagem: "Caixa fechado com sucesso!", resumo: result.recordset });
    } catch (erro) {
        console.error("Erro ao fechar caixa:", erro);
        responderErro(res, erro, "Falha ao fechar caixa.");
    }
}

// Devolve o caixa que está aberto agora (ou id_caixa: null).
// O frontend usa isto ao carregar, para não "esquecer" um caixa aberto ao trocar de tela ou apertar F5.
async function caixaAtual(req, res) {
    try {
        const pool = await connectToDatabase();
        const result = await pool.request().query(
            "SELECT TOP 1 id_caixa, troco_inicial, data_abertura FROM Controle_Caixa WHERE status_caixa = 'ABERTO' ORDER BY id_caixa DESC"
        );
        res.json(result.recordset[0] || { id_caixa: null });
    } catch (erro) {
        console.error("Erro ao consultar caixa atual:", erro);
        responderErro(res, erro, "Falha ao consultar o caixa.");
    }
}

module.exports = { abrirCaixa, fecharCaixa, caixaAtual };
