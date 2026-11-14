// Responde ao frontend com a mensagem certa.
// Erros de regra de negócio das procedures (THROW 50000 a 50999) têm texto próprio,
// pensado para o usuário (ex.: "Estoque insuficiente para o produto: teste.").
// Qualquer outro erro (conexão, bug, constraint) vira uma mensagem genérica,
// e o detalhe técnico fica só no terminal do backend.
function responderErro(res, erro, mensagemPadrao) {
    const info = erro && erro.originalError && erro.originalError.info;
    const numero = (erro && erro.number) || (info && info.number);

    if (numero >= 50000 && numero < 51000) {
        return res.status(400).json({ erro: erro.message, codigo: numero });
    }
    return res.status(500).json({ erro: mensagemPadrao });
}

module.exports = { responderErro };
