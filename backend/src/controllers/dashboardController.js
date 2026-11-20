const { connectToDatabase } = require('../config/db');

// Alimenta a tela inicial: resumo do mês (DRE), produtos para repor, contas a pagar e últimas movimentações.
async function obterDashboard(req, res) {
    try {
        const pool = await connectToDatabase();

        const [resumo, dre, alertas, movimentacoes, contasResumo, contasProximas] = await Promise.all([
            pool.request().query(`
                SELECT CONVERT(CHAR(7), SYSDATETIME(), 23) AS mes,
                       ISNULL(D.Faturamento_Real_Recebido, 0) AS faturamento,
                       ISNULL(D.Custo_Produtos, 0)            AS custo,
                       ISNULL(D.Despesas_Operacionais, 0)     AS despesas,
                       ISNULL(D.Lucro_Liquido, 0)             AS lucro,
                       ISNULL(D.Taxas_Pagamento, 0)           AS taxas
                FROM (SELECT 1 AS x) X
                LEFT JOIN dbo.vw_RelatorioMensal_DRE D ON D.Mes = CONVERT(CHAR(7), SYSDATETIME(), 23)
            `),
            pool.request().query(`SELECT TOP 6 * FROM dbo.vw_RelatorioMensal_DRE ORDER BY Mes DESC`),
            pool.request().query(`SELECT * FROM dbo.vw_SugestaoCompra ORDER BY (estoque_atual - estoque_minimo), Produto`),
            pool.request().query(`
                SELECT TOP 10
                       CONVERT(CHAR(10), M.data_mov, 103) AS data,
                       M.tipo, M.produto, M.qtd, M.valor
                FROM (
                    SELECT V.data_venda AS data_mov, 'entrada' AS tipo, P.nome AS produto,
                           I.quantidade AS qtd, I.subtotal AS valor
                    FROM dbo.ItensVenda I
                    JOIN dbo.Vendas V   ON V.id_venda = I.id_venda AND V.status_venda = 'CONCLUIDA'
                    JOIN dbo.Produtos P ON P.id_produto = I.id_produto
                    UNION ALL
                    SELECT CAST(D.data_pagamento AS DATETIME2(0)), 'saida', D.descricao, NULL, D.valor_total
                    FROM dbo.Despesas D
                    WHERE D.status_pagamento = 'PAGO'
                ) M
                ORDER BY M.data_mov DESC
            `),
            // Contas pendentes que já venceram ou vencem hoje
            pool.request().query(`
                SELECT situacao, COUNT(*) AS qtd, SUM(valor_total) AS valor
                FROM dbo.vw_ContasPagar
                WHERE status_pagamento = 'PENDENTE' AND situacao IN ('ATRASADA', 'VENCE HOJE')
                GROUP BY situacao
            `),
            // Próximas 5 contas pendentes
            pool.request().query(`
                SELECT TOP 5 id_despesa, descricao,
                       CONVERT(CHAR(10), data_vencimento, 103) AS vencimento,
                       valor_total, situacao
                FROM dbo.vw_ContasPagar
                WHERE status_pagamento = 'PENDENTE'
                ORDER BY data_vencimento, id_despesa
            `)
        ]);

        res.json({
            resumo: resumo.recordset[0],
            dre: dre.recordset,
            alertas: alertas.recordset,
            movimentacoes: movimentacoes.recordset,
            contas: { resumo: contasResumo.recordset, proximas: contasProximas.recordset }
        });
    } catch (erro) {
        console.error("Erro ao montar o dashboard:", erro);
        res.status(500).json({ erro: "Falha ao carregar os dados do dashboard." });
    }
}

module.exports = { obterDashboard };