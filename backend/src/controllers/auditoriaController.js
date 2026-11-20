const { connectToDatabase, sql } = require('../config/db');

// GET /api/auditoria/estoque?dias=30&tipo=ENTRADA|SAIDA
//   Histórico de movimentação de estoque: quem fez, quanto, e o saldo que ficou.
async function movimentosEstoque(req, res) {
    try {
        const d = Number.parseInt(req.query.dias, 10);
        const dias = Number.isInteger(d) && d >= 1 && d <= 730 ? d : 30;
        const tipo = ['ENTRADA', 'SAIDA'].includes(String(req.query.tipo)) ? String(req.query.tipo) : null;

        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('dias', sql.Int, dias)
            .input('tipo', sql.VarChar(10), tipo)
            .query(`
                SELECT TOP 500
                       id_movimento,
                       CONVERT(CHAR(10), data_movimento, 103) + ' ' + CONVERT(CHAR(5), data_movimento, 108) AS data,
                       produto, tipo_movimento, quantidade, estoque_resultante,
                       motivo, usuario_responsavel, id_venda
                FROM dbo.vw_AuditoriaEstoque
                WHERE data_movimento >= DATEADD(DAY, -@dias, SYSDATETIME())
                  AND (@tipo IS NULL OR tipo_movimento = @tipo)
                ORDER BY id_movimento DESC
            `);
        res.json(result.recordset);
    } catch (erro) {
        console.error('Erro na auditoria de estoque:', erro);
        res.status(500).json({ erro: 'Falha ao carregar o histórico de estoque.' });
    }
}

// GET /api/auditoria/erros  -> últimos 100 erros registrados pelas procedures
async function errosDoSistema(req, res) {
    try {
        const pool = await connectToDatabase();
        const result = await pool.request().query(`
            SELECT TOP 100 id_erro,
                   CONVERT(CHAR(10), data_erro, 103) + ' ' + CONVERT(CHAR(5), data_erro, 108) AS data,
                   origem, numero_erro, mensagem, detalhes
            FROM dbo.Log_Erros
            ORDER BY id_erro DESC
        `);
        res.json(result.recordset);
    } catch (erro) {
        console.error('Erro ao ler o log de erros:', erro);
        res.status(500).json({ erro: 'Falha ao carregar o log de erros.' });
    }
}

module.exports = { movimentosEstoque, errosDoSistema };