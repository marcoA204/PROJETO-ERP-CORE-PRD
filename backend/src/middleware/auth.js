const { connectToDatabase, sql } = require('../config/db');
const { hashToken } = require('../utils/senha');
const { podeAcessar } = require('./permissoes');

// 1) Confere o token enviado no cabeçalho "Authorization: Bearer <token>"
//    e carrega o usuário (com o perfil ATUAL do banco) em req.usuario.
async function autenticar(req, res, next) {
    try {
        const cabecalho = req.headers.authorization || '';
        const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7).trim() : '';
        if (!token) {
            return res.status(401).json({ erro: 'Faça login para continuar.' });
        }

        const hash = hashToken(token);
        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('hash', sql.Char(64), hash)
            .query(`
                SELECT U.id_usuario, U.nome, U.login, U.perfil, U.deve_trocar_senha
                FROM dbo.Sessoes S
                JOIN dbo.Usuarios U ON U.id_usuario = S.id_usuario
                WHERE S.token_hash = @hash AND S.expira_em > SYSDATETIME() AND U.ativo = 1
            `);

        const u = result.recordset[0];
        if (!u) {
            return res.status(401).json({ erro: 'Sessão expirada. Entre novamente.' });
        }

        req.usuario = {
            id_usuario: u.id_usuario,
            nome: u.nome,
            login: u.login,
            perfil: u.perfil,
            deve_trocar_senha: Boolean(u.deve_trocar_senha),
        };
        req.tokenHash = hash;
        next();
    } catch (erro) {
        console.error('Erro ao validar a sessão:', erro);
        res.status(500).json({ erro: 'Falha ao validar a sessão.' });
    }
}

// 2) Confere se o perfil do usuário pode usar esta rota (matriz em permissoes.js)
function autorizar(req, res, next) {
    const u = req.usuario;

    // Senha provisória: só deixa trocar a senha, mais nada.
    if (u.deve_trocar_senha) {
        return res.status(403).json({ erro: 'Troque a sua senha para continuar.', codigo: 'TROCAR_SENHA' });
    }
    if (!podeAcessar(u.perfil, req.method, req.path)) {
        return res.status(403).json({ erro: 'Você não tem permissão para esta ação.' });
    }
    next();
}

module.exports = { autenticar, autorizar };