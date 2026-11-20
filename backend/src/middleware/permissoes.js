// MATRIZ DE PERMISSÕES — o único lugar que decide quem pode o quê.
//
// Cada regra: [método, padrão do caminho (sem o /api), quem pode]
// A PRIMEIRA regra que combinar vale. Se nenhuma combinar, só GERENTE pode
// (ou seja: tudo que não foi liberado explicitamente para o operador é negado).
//
//   'QUALQUER' = qualquer usuário logado (operador ou gerente)
//   'GERENTE'  = somente gerente/proprietário
const REGRAS = [
    // Produtos: o operador só LÊ a lista (precisa dela no PDV). Alterar é do gerente.
    ['GET',  /^\/produtos\/?$/,                   'QUALQUER'],
    ['*',    /^\/produtos(\/|$)/,                 'GERENTE'],

    // Clientes: o operador só escolhe o cliente na venda.
    ['GET',  /^\/clientes\/?$/,                   'QUALQUER'],
    ['*',    /^\/clientes(\/|$)/,                 'GERENTE'],

    // Vendas: o operador vende e imprime o recibo. Histórico e cancelamento são do gerente.
    ['POST', /^\/vendas\/?$/,                     'QUALQUER'],
    ['GET',  /^\/vendas\/\d+\/recibo\/?$/,        'QUALQUER'],
    ['*',    /^\/vendas(\/|$)/,                   'GERENTE'],

    // Caixa: abrir, fechar e consultar o turno.
    ['*',    /^\/caixa(\/|$)/,                    'QUALQUER'],

    // Configurações: todos leem (o app precisa do perfil do negócio); só o gerente altera.
    ['GET',  /^\/configuracoes\/?$/,              'QUALQUER'],

    // Todo o resto (dashboard, análises, taxas, despesas, orçamentos, usuários, auditoria...)
    // cai na regra padrão abaixo: GERENTE.
];

function perfilNecessario(metodo, caminho) {
    for (const [m, padrao, perfil] of REGRAS) {
        if ((m === '*' || m === metodo) && padrao.test(caminho)) return perfil;
    }
    return 'GERENTE';
}

function podeAcessar(perfilUsuario, metodo, caminho) {
    const exigido = perfilNecessario(metodo, caminho);
    return exigido === 'QUALQUER' || perfilUsuario === 'GERENTE';
}

module.exports = { REGRAS, perfilNecessario, podeAcessar };