// Gera o "Pix Copia e Cola" (BR Code do Banco Central) com valor fixo.
// É o texto que vira QR Code e também pode ser colado no app do banco.
// Não precisa de internet nem de conta em nenhum serviço: só da sua chave Pix.

// Monta um campo no formato do BR Code: ID + tamanho (2 dígitos) + valor
function campo(id, valor) {
    const texto = String(valor);
    return id + String(texto.length).padStart(2, '0') + texto;
}

// Nome e cidade: o padrão aceita só letras/números/espaço, sem acento, em MAIÚSCULAS
function limparTexto(texto, max) {
    return String(texto || '')
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^A-Za-z0-9 ]/g, '')
        .trim()
        .toUpperCase()
        .slice(0, max);
}

// Código de verificação (CRC16-CCITT) exigido pelo padrão
function crc16(texto) {
    let crc = 0xFFFF;
    for (const byte of Buffer.from(texto, 'utf8')) {
        crc ^= byte << 8;
        for (let i = 0; i < 8; i++) {
            crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
        }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
}

function gerarPixCopiaECola({ chave, nome, cidade, valor, txid }) {
    const chaveLimpa = String(chave || '').trim();
    if (!chaveLimpa) throw new Error('Chave Pix não configurada.');

    const valorNumero = Number(valor);
    if (!Number.isFinite(valorNumero) || valorNumero <= 0) throw new Error('Valor do Pix inválido.');

    const idTransacao = String(txid || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

    const contaPix = campo('00', 'br.gov.bcb.pix') + campo('01', chaveLimpa);

    const semCrc =
        campo('00', '01') +                              // versão do formato
        campo('01', '12') +                              // uso único
        campo('26', contaPix) +                          // dados da conta Pix
        campo('52', '0000') +                            // categoria do comerciante
        campo('53', '986') +                             // moeda: Real
        campo('54', valorNumero.toFixed(2)) +            // valor exato da venda
        campo('58', 'BR') +                              // país
        campo('59', limparTexto(nome, 25) || 'LOJA') +   // nome de quem recebe
        campo('60', limparTexto(cidade, 15) || 'BRASIL') + // cidade
        campo('62', campo('05', idTransacao)) +          // identificador da venda
        '6304';                                          // campo do CRC (o valor vem a seguir)

    return semCrc + crc16(semCrc);
}

module.exports = { gerarPixCopiaECola, crc16 };
