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

        // Conciliação: bruto, taxa e líquido de cada forma de pagamento deste turno
        const conciliacao = await pool.request()
            .input('turno', sql.Int, id_caixa)
            .query(`
                SELECT forma_pagamento, qtd_pagamentos, valor_bruto, valor_taxa, valor_liquido
                FROM dbo.vw_ConciliacaoCaixa
                WHERE Turno = @turno
                ORDER BY valor_bruto DESC
            `);

        res.json({ mensagem: "Caixa fechado com sucesso!", resumo: result.recordset, formas: conciliacao.recordset });
    } catch (erro) {
        console.error("Erro ao fechar caixa:", erro);
        responderErro(res, erro, "Falha ao fechar caixa.");
    }
}

// Devolve o caixa que está aberto agora (ou id_caixa: null), com os totais REAIS do turno
// (vindos do banco, não da memória da página: sobrevivem ao F5 e à troca de tela).
async function caixaAtual(req, res) {
    try {
        const pool = await connectToDatabase();
        const result = await pool.request().query(`
            SELECT TOP 1 C.id_caixa, C.troco_inicial, C.data_abertura,
                   F.Faturamento_Total AS vendas_turno,
                   F.Dinheiro_Em_Caixa_Fisico AS dinheiro_gaveta,
                   F.Taxas_Total AS taxas_turno,
                   (SELECT COUNT(*) FROM dbo.Vendas V
                     WHERE V.id_caixa = C.id_caixa AND V.status_venda = 'CONCLUIDA') AS qtd_vendas,
                   (SELECT ISNULL(SUM(D.valor_total), 0) FROM dbo.Despesas D
                     WHERE D.status_pagamento = 'PAGO'
                       AND D.data_pagamento >= CAST(C.data_abertura AS DATE)) AS despesas_pagas
            FROM dbo.Controle_Caixa C
            JOIN dbo.vw_FechamentoCaixa F ON F.Turno = C.id_caixa
            WHERE C.status_caixa = 'ABERTO'
            ORDER BY C.id_caixa DESC
        `);
        const caixa = result.recordset[0];
        if (!caixa) return res.json({ id_caixa: null });
        // Despesas são informação do gerente (o operador não acessa /despesas)
        if (!req.usuario || req.usuario.perfil !== 'GERENTE') delete caixa.despesas_pagas;
        res.json(caixa);
    } catch (erro) {
        console.error("Erro ao consultar caixa atual:", erro);
        responderErro(res, erro, "Falha ao consultar o caixa.");
    }
}

module.exports = { abrirCaixa, fecharCaixa, caixaAtual };