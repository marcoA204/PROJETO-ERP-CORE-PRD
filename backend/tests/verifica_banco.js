// Verifica se o banco ERP_PDV_Master está com TODAS as versões instaladas (v4.0 até v4.4 + analytics)
// e se os dados estão coerentes. Só LÊ: não altera nada.
//
// Como rodar (dentro da pasta backend):   node tests/verifica_banco.js
const { connectToDatabase } = require('../src/config/db');

const resultados = [];
const ok = (nome, extra = '') => resultados.push({ nome, ok: true, extra });
const falha = (nome, extra = '') => resultados.push({ nome, ok: false, extra });
const aviso = (nome, extra = '') => resultados.push({ nome, ok: true, aviso: true, extra });

const TABELAS = [
  'Categorias', 'Marcas', 'Produtos', 'Controle_Caixa', 'Vendas', 'PagamentosVenda', 'ItensVenda',
  'Historico_Movimentacao_Estoque', 'Despesas',                                   // v4.0
  'Log_Erros',                                                                    // v4.0
  'Clientes', 'Configuracoes', 'FichaTecnica', 'Orcamentos', 'ItensOrcamento',    // v4.2
  'TaxasPagamento',                                                               // v4.3
  'Usuarios', 'Sessoes',                                                          // v4.4
];
const VIEWS = [
  'vw_CatalogoProdutos', 'vw_SugestaoCompra', 'vw_FechamentoCaixa', 'vw_RelatorioMensal_DRE', 'vw_ErrosRecentes',
  'vw_ContasPagar', 'vw_HistoricoVendas',                                         // v4.1
  'vw_Orcamentos',                                                                // v4.2
  'vw_ConciliacaoCaixa',                                                          // v4.3
  'vw_AuditoriaEstoque',                                                          // v4.4
];
const PROCEDURES = [
  'sp_RegistrarErro', 'sp_SalvarProduto', 'sp_AbrirCaixa', 'sp_FecharCaixa', 'sp_EntradaEstoque',
  'sp_RegistrarVenda', 'sp_RegistrarItemVenda',
  'sp_AtualizarProduto', 'sp_InativarProduto', 'sp_LancarDespesa', 'sp_PagarDespesa', 'sp_CancelarVenda',  // v4.1
  'sp_SalvarCliente', 'sp_InativarCliente', 'sp_SalvarNicho', 'sp_SalvarFichaTecnica',
  'sp_CriarOrcamento', 'sp_CancelarOrcamento',                                    // v4.2
  'sp_SalvarTaxas',                                                               // v4.3
  'sp_SalvarUsuario', 'sp_AlterarSenha',                                          // v4.4
];
const FUNCOES = ['fn_CurvaABC', 'fn_EstoqueParado', 'fn_PicoVendas'];            // analytics
const COLUNAS = [
  ['Vendas', 'motivo_cancelamento'], ['Vendas', 'data_cancelamento'], ['Vendas', 'id_cliente'],
  ['Historico_Movimentacao_Estoque', 'id_venda'], ['Historico_Movimentacao_Estoque', 'usuario_responsavel'],
  ['Historico_Movimentacao_Estoque', 'estoque_resultante'],
  ['PagamentosVenda', 'taxa_percentual'], ['PagamentosVenda', 'valor_taxa'],
  ['Produtos', 'data_cadastro'], ['ItensVenda', 'subtotal'],
];

async function main() {
  const pool = await connectToDatabase();
  const q = async (texto) => (await pool.request().query(texto)).recordset;

  // 1. Objetos existentes
  const existentes = new Set((await q(`SELECT name FROM sys.objects WHERE schema_id = SCHEMA_ID('dbo')`)).map(r => r.name.toLowerCase()));
  for (const [rotulo, lista] of [['Tabela', TABELAS], ['View', VIEWS], ['Procedure', PROCEDURES], ['Função', FUNCOES]]) {
    for (const nome of lista) {
      existentes.has(nome.toLowerCase()) ? ok(`${rotulo} ${nome}`) : falha(`${rotulo} ${nome}`, 'NÃO existe — falta rodar algum script de migração');
    }
  }

  // 2. Colunas importantes
  const colunas = new Set((await q(`SELECT t.name AS tabela, c.name AS coluna FROM sys.columns c JOIN sys.tables t ON t.object_id = c.object_id`))
    .map(r => `${r.tabela}.${r.coluna}`.toLowerCase()));
  for (const [t, c] of COLUNAS) {
    colunas.has(`${t}.${c}`.toLowerCase()) ? ok(`Coluna ${t}.${c}`) : falha(`Coluna ${t}.${c}`, 'não existe');
  }

  // 3. Versão das procedures (confere que as MAIS NOVAS estão instaladas)
  const def = async (nome) => (await q(`SELECT OBJECT_DEFINITION(OBJECT_ID('dbo.${nome}')) AS d`))[0]?.d || '';
  const venda = await def('sp_RegistrarVenda');
  const cancela = await def('sp_CancelarVenda');
  // Cobre TODOS os objetos que o script v4.0 cria e que as etapas depois substituem
  // (se o v4.0 rodar de novo, eles voltam para a versão antiga).
  const E2 = 'ERP_CORE_etapa2_v4.2.sql', E3 = 'ERP_CORE_etapa3_v4.3.sql', E4 = 'ERP_CORE_etapa4_v4.4.sql';
  const checks = [
    ['sp_RegistrarVenda tem ficha técnica (v4.2)', venda.includes('FichaTecnica'), E2],
    ['sp_RegistrarVenda grava a taxa (v4.3)', venda.includes('taxa_percentual'), E3],
    ['sp_RegistrarVenda grava o usuário (v4.4)', venda.includes('@usuario'), E4],
    ['sp_CancelarVenda devolve pelo histórico (v4.2)', cancela.includes('Historico_Movimentacao_Estoque'), E2],
    ['sp_CancelarVenda grava o usuário (v4.4)', cancela.includes('@usuario'), E4],
    ['sp_EntradaEstoque grava o usuário (v4.4)', (await def('sp_EntradaEstoque')).includes('@usuario'), E4],
    ['sp_SalvarProduto grava o usuário (v4.4)', (await def('sp_SalvarProduto')).includes('@usuario'), E4],
    ['vw_RelatorioMensal_DRE desconta taxas (v4.3)', (await def('vw_RelatorioMensal_DRE')).includes('Taxas_Pagamento'), E3],
    ['vw_CatalogoProdutos tem tem_ficha (v4.2)', (await def('vw_CatalogoProdutos')).includes('tem_ficha'), E2],
    ['vw_SugestaoCompra ignora receitas (v4.2)', (await def('vw_SugestaoCompra')).includes('FichaTecnica'), E2],
    ['vw_FechamentoCaixa mostra as taxas (v4.3)', (await def('vw_FechamentoCaixa')).includes('valor_taxa'), E3],
  ];
  for (const [nome, passou, script] of checks) {
    passou ? ok(nome) : falha(nome, `versão antiga instalada — rode de novo a partir de ${script} (na ordem, até a etapa 4)`);
  }

  // 4. Dados coerentes
  const um = async (texto) => (await q(texto))[0];

  let r = await um(`SELECT COUNT(*) AS n FROM dbo.Produtos WHERE estoque_atual < 0`);
  r.n === 0 ? ok('Nenhum produto com estoque negativo') : falha('Estoque negativo', `${r.n} produto(s)`);

  r = await um(`SELECT COUNT(*) AS n FROM dbo.Controle_Caixa WHERE status_caixa = 'ABERTO'`);
  r.n <= 1 ? ok(`No máximo 1 caixa aberto (${r.n})`) : falha('Mais de um caixa aberto', `${r.n}`);

  r = await um(`SELECT COUNT(*) AS n FROM dbo.Usuarios WHERE perfil = 'GERENTE' AND ativo = 1`);
  r.n >= 1 ? ok(`Existe gerente ativo (${r.n})`) : falha('Nenhum gerente ativo', 'o backend cria o admin ao subir; reinicie-o (rs)');

  r = await um(`SELECT valor FROM dbo.Configuracoes WHERE chave = 'nicho'`);
  ['VAREJO', 'ALIMENTACAO'].includes(r?.valor) ? ok(`Perfil do negócio: ${r.valor}`) : falha('Configuração "nicho" inválida', String(r?.valor));

  r = await um(`SELECT COUNT(*) AS n FROM dbo.TaxasPagamento`);
  r.n >= 6 ? ok('Taxas cadastradas (6 formas)') : falha('Tabela de taxas incompleta', `${r.n}/6`);

  r = await um(`SELECT COUNT(*) AS n FROM dbo.Vendas V WHERE V.status_venda = 'CONCLUIDA'
                AND ABS(V.valor_total - ISNULL((SELECT SUM(I.subtotal) FROM dbo.ItensVenda I WHERE I.id_venda = V.id_venda), 0)) > 0.009`);
  r.n === 0 ? ok('Total de cada venda = soma dos itens') : falha('Venda com total diferente da soma dos itens', `${r.n} venda(s)`);

  r = await um(`SELECT COUNT(*) AS n FROM dbo.Vendas V WHERE V.status_venda = 'CONCLUIDA'
                AND ABS((V.valor_total - V.valor_desconto) - ISNULL((SELECT SUM(P.valor_pago) FROM dbo.PagamentosVenda P WHERE P.id_venda = V.id_venda), 0)) > 0.009`);
  r.n === 0 ? ok('Pagamentos = total a receber em todas as vendas')
            : aviso('Vendas com pagamentos diferentes do total', `${r.n} venda(s) — normal em vendas feitas antes da v4.0 (fluxo antigo)`);

  r = await um(`SELECT COUNT(*) AS n FROM dbo.Usuarios WHERE LEN(senha_hash) < 100 OR senha_hash NOT LIKE 'scrypt$%'`);
  r.n === 0 ? ok('Todas as senhas estão como hash scrypt') : falha('Senha fora do formato de hash', `${r.n} usuário(s)`);

  r = await um(`SELECT COUNT(*) AS n FROM dbo.Sessoes WHERE expira_em < SYSDATETIME()`);
  aviso('Sessões vencidas acumuladas', `${r.n} (são apagadas a cada login)`);

  r = await um(`SELECT COUNT(*) AS n FROM dbo.Produtos WHERE nome LIKE 'ZZTESTE%'`);
  r.n === 0 ? ok('Sem sobras de dados de teste') : aviso('Há dados de teste no banco', `${r.n} produto(s) ZZTESTE — rode: node tests/limpar_testes.js --confirmar`);

  // 5. Relatório
  const largura = Math.max(...resultados.map(x => x.nome.length)) + 2;
  let falhas = 0;
  for (const x of resultados) {
    const marca = !x.ok ? '✗ FALHOU' : x.aviso ? '! AVISO ' : '✓ ok    ';
    if (!x.ok) falhas++;
    console.log(`${marca}  ${x.nome.padEnd(largura)} ${x.extra || ''}`);
  }
  const avisos = resultados.filter(x => x.aviso).length;
  console.log(`\n${resultados.length} verificações: ${resultados.length - falhas} ok (${avisos} aviso(s)), ${falhas} falha(s).`);
  process.exit(falhas ? 1 : 0);
}

main().catch(e => { console.error('Não foi possível verificar o banco:', e.message); process.exit(2); });