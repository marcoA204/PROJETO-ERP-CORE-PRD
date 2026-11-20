// Apaga SOMENTE os dados criados pelos testes (tudo que começa com "ZZTESTE" / "zzteste_").
// Por padrão faz um ENSAIO (mostra o que apagaria e desfaz). Para apagar de verdade:
//
//    node tests/limpar_testes.js --confirmar
//    node tests/limpar_testes.js --confirmar --limpar-log     (apaga também os erros do Log_Erros gerados durante o teste)
const fs = require('fs');
const path = require('path');
const { connectToDatabase, sql } = require('../src/config/db');

const confirmar = process.argv.includes('--confirmar');
const limparLog = process.argv.includes('--limpar-log');
const marcador = path.join(__dirname, '.ultimo_teste.json');

async function main() {
  let info = {};
  try { info = JSON.parse(fs.readFileSync(marcador, 'utf8')); } catch { /* sem marcador: segue só pelos nomes */ }

  const pool = await connectToDatabase();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  const rodar = async (texto, params = {}) => {
    const req = new sql.Request(tx);
    for (const [k, v] of Object.entries(params)) req.input(k, v.tipo, v.valor);
    // batch() e não query(): query() roda em sp_executesql e as tabelas #temp somem ao fim de cada chamada
    return req.batch(texto);
  };

  try {
    // Listas do que é de teste (tabelas temporárias valem enquanto a transação existir)
    await rodar(`SELECT id_produto AS id INTO #tp FROM dbo.Produtos WHERE nome LIKE 'ZZTESTE%'`);
    await rodar(`SELECT DISTINCT id_venda AS id INTO #tv FROM dbo.ItensVenda WHERE id_produto IN (SELECT id FROM #tp)`);
    await rodar(`SELECT DISTINCT x.id INTO #to FROM (
                   SELECT id_orcamento AS id FROM dbo.ItensOrcamento WHERE id_produto IN (SELECT id FROM #tp)
                   UNION SELECT id_orcamento FROM dbo.Orcamentos WHERE id_venda IN (SELECT id FROM #tv)) x`);

    // Ordem importa por causa das chaves estrangeiras (filhos antes dos pais)
    const passos = [
      ['ItensOrcamento',  `DELETE FROM dbo.ItensOrcamento WHERE id_orcamento IN (SELECT id FROM #to)`],
      ['Orcamentos',      `DELETE FROM dbo.Orcamentos WHERE id_orcamento IN (SELECT id FROM #to)`],
      ['Historico_Movimentacao_Estoque', `DELETE FROM dbo.Historico_Movimentacao_Estoque WHERE id_produto IN (SELECT id FROM #tp) OR id_venda IN (SELECT id FROM #tv)`],
      ['PagamentosVenda', `DELETE FROM dbo.PagamentosVenda WHERE id_venda IN (SELECT id FROM #tv)`],
      ['ItensVenda',      `DELETE FROM dbo.ItensVenda WHERE id_venda IN (SELECT id FROM #tv)`],
      ['Vendas',          `DELETE FROM dbo.Vendas WHERE id_venda IN (SELECT id FROM #tv)`],
      ['FichaTecnica',    `DELETE FROM dbo.FichaTecnica WHERE id_produto IN (SELECT id FROM #tp) OR id_ingrediente IN (SELECT id FROM #tp)`],
      ['Produtos',        `DELETE FROM dbo.Produtos WHERE id_produto IN (SELECT id FROM #tp)`],
      ['Categorias',      `DELETE FROM dbo.Categorias WHERE nome LIKE 'ZZTESTE%' AND id_categoria NOT IN (SELECT id_categoria FROM dbo.Produtos WHERE id_categoria IS NOT NULL)`],
      ['Clientes',        `DELETE FROM dbo.Clientes WHERE nome LIKE 'ZZTESTE%'`],
      ['Despesas',        `DELETE FROM dbo.Despesas WHERE descricao LIKE 'ZZTESTE%'`],
      ['Sessoes (usuários de teste)', `DELETE FROM dbo.Sessoes WHERE id_usuario IN (SELECT id_usuario FROM dbo.Usuarios WHERE login LIKE 'zzteste[_]%')`],
      ['Usuarios',        `DELETE FROM dbo.Usuarios WHERE login LIKE 'zzteste[_]%'`],
    ];
    if (info.caixaId) {
      passos.push([`Controle_Caixa #${info.caixaId} (aberto pelo teste, se ficou vazio)`,
        `DELETE FROM dbo.Controle_Caixa WHERE id_caixa = ${Number(info.caixaId)} AND NOT EXISTS (SELECT 1 FROM dbo.Vendas WHERE id_caixa = ${Number(info.caixaId)})`]);
    }
    if (limparLog && info.inicio) {
      passos.push(['Log_Erros desde o início do teste',
        `DELETE FROM dbo.Log_Erros WHERE data_erro >= CAST('${String(info.inicio).replace(/[^0-9: -]/g, '')}' AS DATETIME2(0))`]);
    }

    console.log(confirmar ? 'APAGANDO dados de teste...\n' : 'ENSAIO (nada será apagado). Use --confirmar para apagar de verdade.\n');
    let total = 0;
    for (const [nome, texto] of passos) {
      const r = await rodar(texto);
      const n = (r.rowsAffected || []).reduce((a, b) => a + b, 0);
      total += n;
      console.log(`${String(n).padStart(5)}  ${nome}`);
    }
    console.log(`\n${total} linha(s) ${confirmar ? 'apagada(s)' : 'seriam apagadas'}.`);

    if (confirmar) { await tx.commit(); try { fs.unlinkSync(marcador); } catch { /* ok */ } }
    else { await tx.rollback(); }
  } catch (e) {
    try { await tx.rollback(); } catch { /* já desfeita */ }
    throw e;
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('Falha na limpeza (nada foi apagado):', e.message); process.exit(1); });