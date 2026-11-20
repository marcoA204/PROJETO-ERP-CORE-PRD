const { connectToDatabase, sql } = require('../config/db');
const { responderErro } = require('../utils/erroHttp');
const { hashSenha, SENHA_MINIMA } = require('../utils/senha');

// GET /api/usuarios
async function listarUsuarios(req, res) {
    try {
        const pool = await connectToDatabase();
        const result = await pool.request().query(`
            SELECT id_usuario, nome, login, perfil, ativo, deve_trocar_senha,
                   CASE WHEN ultimo_acesso IS NULL THEN NULL
                        ELSE CONVERT(CHAR(10), ultimo_acesso, 103) + ' ' + CONVERT(CHAR(5), ultimo_acesso, 108) END AS ultimo_acesso
            FROM dbo.Usuarios
            ORDER BY ativo DESC, nome
        `);
        res.json(result.recordset);
    } catch (erro) {
        console.error('Erro ao listar usuários:', erro);
        res.status(500).json({ erro: 'Falha ao carregar os usuários.' });
    }
}

// POST /api/usuarios (novo)  |  PUT /api/usuarios/:id (editar)
//   { nome, login, perfil, senha?, ativo? }
async function salvarUsuario(req, res) {
    try {
        let id = null;
        if (req.params.id !== undefined) {
            id = Number.parseInt(req.params.id, 10);
            if (!Number.isInteger(id) || id <= 0) {
                return res.status(400).json({ erro: 'Usuário inválido.' });
            }
        }
        const { nome, login, perfil } = req.body;
        const ativo = req.body.ativo === undefined ? true : Boolean(req.body.ativo);
        const senha = req.body.senha ? String(req.body.senha) : '';
        const ehEuMesmo = id !== null && id === req.usuario.id_usuario;

        if (senha && senha.length < SENHA_MINIMA) {
            return res.status(400).json({ erro: `A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.` });
        }
        if (id === null && !senha) {
            return res.status(400).json({ erro: 'Informe uma senha para o novo usuário.' });
        }
        // Evita se trancar para fora do sistema por engano
        if (ehEuMesmo && (!ativo || String(perfil).toUpperCase() !== req.usuario.perfil)) {
            return res.status(400).json({ erro: 'Você não pode mudar o seu próprio perfil nem desativar a si mesmo.' });
        }
        if (ehEuMesmo && senha) {
            return res.status(400).json({ erro: 'Para trocar a sua senha use "Alterar senha" no menu.' });
        }

        const pool = await connectToDatabase();
        const result = await pool.request()
            .input('id_usuario', sql.Int, id)
            .input('nome', sql.VarChar(100), String(nome || '').trim())
            .input('login', sql.VarChar(50), String(login || '').trim())
            .input('senha_hash', sql.VarChar(200), senha ? await hashSenha(senha) : null)
            .input('perfil', sql.VarChar(10), String(perfil || ''))
            .input('ativo', sql.Bit, ativo)
            // senha definida por outra pessoa é provisória: a pessoa troca no primeiro acesso
            .input('forcar_troca', sql.Bit, Boolean(senha))
            .execute('sp_SalvarUsuario');

        const salvo = result.recordset[0] || {};
        res.status(id ? 200 : 201).json({
            mensagem: id ? 'Usuário atualizado!' : 'Usuário criado! Ele deverá trocar a senha no primeiro acesso.',
            id_usuario: salvo.id_usuario,
        });
    } catch (erro) {
        console.error('Erro ao salvar usuário:', erro);
        responderErro(res, erro, 'Falha ao salvar o usuário.');
    }
}

module.exports = { listarUsuarios, salvarUsuario };