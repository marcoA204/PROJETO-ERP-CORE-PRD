const { connectToDatabase, sql } = require('../config/db');

async function abrirCaixa(req, res) {
    try{
        const { troco_inicial } = req.body;
        const pool = await connectToDatabase();
        await pool.request()
            .input('troco_incial', sql.Decimal(10,2), troco_incial || 0)
            .query('INSERT INTO Controle_Caixa (troco_inicial) VALUES (@troco_incial)');

        res.status(201).json({ mensagem: "Caixa aberto com sucesso!" });
    } catch (erro) {
        console.log("Erro aoa abrir caixa:", erro);
        res.status(500).json({ erro: "Falha ao abrir caixa." });
    }
}

async function fecharCaixa(req, res) {
    try {
        const { id_caixa } = req.body;
        const pool = await connectToDatabase();
        await pool.request()
            .input('id_caixa', sql.Int, id_caixa)
            .query("UPDATE Controle_Caixa SET status_caixa = 'FECHADO', data_fechamento = GETDATE() WHERE id_caixa = @id_caixa ");

        res.json({ mensagem: "Caixa fechado com sucesso!" });
    }catch (erro) {
        console.error("Erro ao fechar caixa:", erro);
        res.status(500).json({ erro: "Falhar ao fechar caixa." });
    }
}

module.exports = { abrirCaixa, fecharCaixa };