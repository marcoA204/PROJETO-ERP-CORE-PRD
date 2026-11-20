const { connectToDatabase, sql } = require('../config/db');
const { hashSenha } = require('./senha');

// Se ainda não existe NENHUM usuário, cria o gerente inicial.
// A senha provisória vem de ADMIN_SENHA_INICIAL (no .env) ou, se não houver, "admin123".
// Nos dois casos o sistema obriga a trocar a senha no primeiro acesso.
async function garantirAdminInicial() {
    try {
        const pool = await connectToDatabase();
        const total = await pool.request().query(`SELECT COUNT(*) AS n FROM dbo.Usuarios`);
        if (total.recordset[0].n > 0) return;

        const senha = process.env.ADMIN_SENHA_INICIAL || 'admin123';
        await pool.request()
            .input('nome', sql.VarChar(100), 'Administrador')
            .input('login', sql.VarChar(50), 'admin')
            .input('senha_hash', sql.VarChar(200), await hashSenha(senha))
            .input('perfil', sql.VarChar(10), 'GERENTE')
            .input('forcar_troca', sql.Bit, true)
            .execute('sp_SalvarUsuario');

        console.log("🔐 Usuário inicial criado: login 'admin' (a senha provisória será pedida para trocar no primeiro acesso).");
    } catch (erro) {
        console.error('⚠️  Não foi possível criar o usuário inicial. O script database/ERP_CORE_etapa4_v4.4.sql foi executado?');
        console.error('   Detalhe:', erro.message);
    }
}

module.exports = { garantirAdminInicial };