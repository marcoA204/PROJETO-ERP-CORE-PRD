const { connectToDatabase, sql } = require('../config/db');
const { responderErro } = require('../utils/erroHttp');
const { hashSenha, verificarSenha, gerarToken, SENHA_MINIMA } = require('../utils/senha');

const HORAS_DE_SESSAO = 12;

// Proteção contra adivinhação de senha: 5 erros seguidos bloqueiam por 15 minutos.
const MAX_FALHAS = 5;
const BLOQUEIO_MS = 15 * 60 * 1000;
const falhas = new Map(); // "ip|login" -> { n, ate }

const chaveDe = (req, login) => `${req.ip}|${String(login).toLowerCase()}`;
function minutosBloqueado(chave) {
    const f = falhas.get(chave);
    return f && f.ate > Date.now() ? Math.ceil((f.ate - Date.now()) / 60000) : 0;
}
function registrarFalha(chave) {
    const f = falhas.get(chave) || { n: 0, ate: 0 };
    f.n += 1;
    if (f.n >= MAX_FALHAS) { f.ate = Date.now() + BLOQUEIO_MS; f.n = 0; }
    falhas.set(chave, f);
}

// Hash de mentira, só para gastar o mesmo tempo quando o login não existe
// (assim ninguém descobre quais logins existem medindo o tempo de resposta).
const HASH_FALSO = 'scrypt$00000000000000000000000000000000$' + '0'.repeat(128);

const dadosPublicos = (u) => ({
    id_usuario: u.id_usuario,
    nome: u.nome,
    login: u.login,
    perfil: u.perfil,
    deve_trocar_senha: Boolean(u.deve_trocar_senha),
});

// POST /api/auth/login  { login, senha }
async function login(req, res) {
    try {
        const loginDigitado = String(req.body.login || '').trim().toLowerCase();
        const senha = String(req.body.senha || '');
        if (!loginDigitado || !senha) {
            return res.status(400).json({ erro: 'Informe o usuário e a senha.' });
        }

        const chave = chaveDe(req, loginDigitado);
        const espera = minutosBloqueado(chave);
        if (espera > 0) {
            return res.status(429).json({ erro: `Muitas tentativas erradas. Tente de novo em ${espera} minuto(s).` });
        }

        const pool = await connectToDatabase();
        const achado = await pool.request()
            .input('login', sql.VarChar(50), loginDigitado)
            .query(`SELECT id_usuario, nome, login, senha_hash, perfil, deve_trocar_senha
                    FROM dbo.Usuarios WHERE login = @login AND ativo = 1`);
        const usuario = achado.recordset[0];

        const confere = await verificarSenha(senha, usuario ? usuario.senha_hash : HASH_FALSO);
        if (!usuario || !confere) {
            registrarFalha(chave);
            // mesma mensagem para "usuário não existe" e "senha errada"
            return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
        }
        falhas.delete(chave);

        const { token, hash } = gerarToken();
        await pool.request()
            .input('hash', sql.Char(64), hash)
            .input('id', sql.Int, usuario.id_usuario)
            .input('horas', sql.Int, HORAS_DE_SESSAO)
            .query(`
                DELETE FROM dbo.Sessoes WHERE expira_em < SYSDATETIME();
                INSERT INTO dbo.Sessoes (token_hash, id_usuario, expira_em)
                VALUES (@hash, @id, DATEADD(HOUR, @horas, SYSDATETIME()));
                UPDATE dbo.Usuarios SET ultimo_acesso = SYSDATETIME() WHERE id_usuario = @id;
            `);

        res.json({ token, usuario: dadosPublicos(usuario) });
    } catch (erro) {
        console.error('Erro no login:', erro);
        res.status(500).json({ erro: 'Falha ao entrar. Tente novamente.' });
    }
}

// GET /api/auth/me
function me(req, res) {
    res.json({ usuario: req.usuario });
}

// POST /api/auth/logout  (apaga a sessão no banco: o token deixa de valer na hora)
async function logout(req, res) {
    try {
        const pool = await connectToDatabase();
        await pool.request()
            .input('hash', sql.Char(64), req.tokenHash)
            .query(`DELETE FROM dbo.Sessoes WHERE token_hash = @hash`);
        res.json({ mensagem: 'Sessão encerrada.' });
    } catch (erro) {
        console.error('Erro no logout:', erro);
        res.status(500).json({ erro: 'Falha ao sair.' });
    }
}

// POST /api/auth/trocar-senha  { senha_atual, nova_senha }
async function trocarSenha(req, res) {
    try {
        const atual = String(req.body.senha_atual || '');
        const nova = String(req.body.nova_senha || '');

        if (nova.length < SENHA_MINIMA) {
            return res.status(400).json({ erro: `A nova senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` });
        }
        if (nova === atual) {
            return res.status(400).json({ erro: 'A nova senha deve ser diferente da atual.' });
        }

        const pool = await connectToDatabase();
        const achado = await pool.request()
            .input('id', sql.Int, req.usuario.id_usuario)
            .query(`SELECT senha_hash FROM dbo.Usuarios WHERE id_usuario = @id AND ativo = 1`);
        const registro = achado.recordset[0];

        if (!registro || !(await verificarSenha(atual, registro.senha_hash))) {
            // 400 (e não 401) de propósito: senha atual errada não deve derrubar a sessão
            return res.status(400).json({ erro: 'A senha atual está incorreta.' });
        }

        await pool.request()
            .input('id_usuario', sql.Int, req.usuario.id_usuario)
            .input('senha_hash', sql.VarChar(200), await hashSenha(nova))
            .input('manter_token', sql.Char(64), req.tokenHash)
            .execute('sp_AlterarSenha');

        res.json({ mensagem: 'Senha alterada com sucesso!' });
    } catch (erro) {
        console.error('Erro ao trocar a senha:', erro);
        responderErro(res, erro, 'Falha ao trocar a senha.');
    }
}

module.exports = { login, me, logout, trocarSenha };