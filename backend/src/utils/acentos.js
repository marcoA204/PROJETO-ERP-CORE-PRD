// Os scripts SQL são ASCII puro de propósito (evita texto quebrado por codificação do arquivo),
// então as mensagens das procedures chegam sem acento ("Produto nao encontrado").
// Aqui elas são acentuadas antes de ir para a tela. Só palavras/frases conhecidas são trocadas;
// o "e" conjunção nunca é mexido, só o verbo "é" em frases fixas. Nomes de campo (codigo_barras) ficam como estão.

// Frases em que o "e" é o verbo SER (precisam vir antes das palavras soltas)
const FRASES = [
    [/\bso e permitid/g, 'só é permitid'],
    [/\be (obrigatori|ingrediente de outra)/g, 'é $1'],
    [/\besta (fechad|pag|inativ|abert)/g, 'está $1'],
];

// Palavra sem acento -> com acento (a primeira letra maiúscula é tratada sozinha)
const PALAVRAS = {
    nao: 'não', ja: 'já', sao: 'são', so: 'só',
    obrigatoria: 'obrigatória', obrigatorio: 'obrigatório', obrigatorios: 'obrigatórios', obrigatorias: 'obrigatórias',
    tecnica: 'técnica', propria: 'própria', codigo: 'código',
    orcamento: 'orçamento', orcamentos: 'orçamentos',
    usuario: 'usuário', usuarios: 'usuários',
    valido: 'válido', valida: 'válida', invalido: 'inválido', invalida: 'inválida',
    minimo: 'mínimo', maximo: 'máximo', numero: 'número', numeros: 'números',
    minusculas: 'minúsculas', hifen: 'hífen', negocio: 'negócio',
    descricao: 'descrição', precos: 'preços', preco: 'preço', transacao: 'transação',
    reposicao: 'reposição', movimentacao: 'movimentação', informacao: 'informação',
};

const comMaiuscula = (orig, troca) =>
    orig[0] === orig[0].toUpperCase() ? troca[0].toUpperCase() + troca.slice(1) : troca;

// Palavra inteira: o "(?!\w)" impede trocar pedaços como o "codigo" de "codigo_barras"
const RE_PALAVRA = new RegExp(`\\b(${Object.keys(PALAVRAS).join('|')})(?!\\w)`, 'gi');

function acentuar(texto) {
    if (typeof texto !== 'string' || !texto) return texto;
    let t = texto;
    for (const [re, troca] of FRASES) t = t.replace(re, troca);
    t = t.replace(RE_PALAVRA, (m) => {
        const troca = PALAVRAS[m.toLowerCase()];
        return troca ? comMaiuscula(m, troca) : m;
    });
    return t;
}

module.exports = { acentuar };
