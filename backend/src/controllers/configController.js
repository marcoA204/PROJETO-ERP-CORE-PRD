const { connectToDatabase, sql } = require('../config/db');
const { responderErro } = require('../utils/erroHttp');

// GET /api/configuracoes  -> { nicho, onboarding_concluido }
async function obterConfiguracoes(req, res) {
    try {
        const pool = await connectToDatabase();
        const result = await pool.request().query(`SELECT chave, valor FROM dbo.Configuracoes`);
        const mapa = Object.fromEntries(result.recordset.map(r => [r.chave, r.valor]));
        res.json({
            nicho: mapa.nicho || 'VAREJO',
            onboarding_concluido: mapa.onboarding_concluido === '1'
        });
    } catch (erro) {
        console.error("Erro ao ler configurações:", erro);
        res.status(500).json({ erro: "Falha ao carregar as configurações." });
    }
}

// PUT /api/configuracoes  { nicho: "VAREJO" | "ALIMENTACAO" }
async function salvarConfiguracoes(req, res) {
    try {
        const pool = await connectToDatabase();
        await pool.request()
            .input('nicho', sql.VarChar(20), String(req.body.nicho || ''))
            .execute('sp_SalvarNicho');
        res.json({ mensagem: "Perfil do negócio salvo!", nicho: String(req.body.nicho).toUpperCase(), onboarding_concluido: true });
    } catch (erro) {
        console.error("Erro ao salvar configurações:", erro);
        responderErro(res, erro, "Falha ao salvar as configurações.");
    }
}

module.exports = { obterConfiguracoes, salvarConfiguracoes };