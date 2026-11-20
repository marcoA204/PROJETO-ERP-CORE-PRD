const crypto = require('crypto');
const util = require('util');

const scrypt = util.promisify(crypto.scrypt);

// Senha NUNCA é guardada: guardamos "scrypt$sal$hash". O sal é aleatório por usuário,
// então duas pessoas com a mesma senha têm hashes diferentes.
async function hashSenha(senha) {
    const sal = crypto.randomBytes(16);
    const derivado = await scrypt(String(senha), sal, 64);
    return `scrypt$${sal.toString('hex')}$${derivado.toString('hex')}`;
}

async function verificarSenha(senha, armazenado) {
    const [algoritmo, salHex, hashHex] = String(armazenado || '').split('$');
    if (algoritmo !== 'scrypt' || !salHex || !hashHex) return false;

    const esperado = Buffer.from(hashHex, 'hex');
    const derivado = await scrypt(String(senha), Buffer.from(salHex, 'hex'), esperado.length);
    // comparação em tempo constante (não vaza quanto da senha estava certo)
    return derivado.length === esperado.length && crypto.timingSafeEqual(derivado, esperado);
}

// Token de sessão: aleatório, 256 bits. No banco vai só o SHA-256 dele.
function gerarToken() {
    const token = crypto.randomBytes(32).toString('hex');
    return { token, hash: hashToken(token) };
}

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

const SENHA_MINIMA = 8;

module.exports = { hashSenha, verificarSenha, gerarToken, hashToken, SENHA_MINIMA };