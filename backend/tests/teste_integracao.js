// Teste de integração do ERP-CORE: bate na API de verdade (backend rodando) e confere o banco.
//
// Pré-requisitos: backend rodando (npm run dev), banco com v4.0 -> v4.4 + analytics, e no .env:
//     TESTE_ADMIN_LOGIN=admin        (opcional, padrão: admin)
//     TESTE_ADMIN_SENHA=<senha atual do gerente>
// Rodar (dentro da pasta backend):   node tests/teste_integracao.js
//
// Tudo que o teste cria começa com "ZZTESTE" / "zzteste_" e é apagado por:  node tests/limpar_testes.js --confirmar
// As taxas e o perfil do negócio são restaurados ao final, mesmo se o teste falhar.
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { connectToDatabase } = require('../src/config/db');

const BASE = `http://localhost:${process.env.PORT || 3000}/api`;
const ADMIN_LOGIN = process.env.TESTE_ADMIN_LOGIN || 'admin';
const ADMIN_SENHA = process.env.TESTE_ADMIN_SENHA;
const SENHA_PROVISORIA = 'Provisoria#1';
const SENHA_FINAL = 'SenhaFinal#2';
const RODADA = Date.now().toString().slice(-6);

const resultados = [];
let grupoAtual = '';
const grupo = (nome) => { grupoAtual = nome; console.log(`\n── ${nome}`); };

async function t(nome, fn) {
  try {
    await fn();
    resultados.push({ grupo: grupoAtual, nome, ok: true });
    console.log(`  ✓ ${nome}`);
  } catch (e) {
    resultados.push({ grupo: grupoAtual, nome, ok: false, erro: e.message });
    console.log(`  ✗ ${nome}\n      → ${e.message}`);
  }
}
const igual = (obtido, esperado, rotulo = 'valor') => {
  if (obtido !== esperado) throw new Error(`${rotulo}: esperado ${JSON.stringify(esperado)}, veio ${JSON.stringify(obtido)}`);
};
const perto = (obtido, esperado, rotulo = 'valor', tol = 0.011) => {
  if (Math.abs(Number(obtido) - Number(esperado)) > tol) throw new Error(`${rotulo}: esperado ~${esperado}, veio ${obtido}`);
};
const verdade = (cond, msg) => { if (!cond) throw new Error(msg); };
const msgDe = (r) => String((r.data && r.data.erro) || '');
// Mensagem sem acentos, para as conferências por texto: o backend acentua as mensagens do SQL
// ("Ja existe" -> "Já existe"), e o teste deve passar com ou sem acento.
const msgSemAcento = (r) => msgDe(r).normalize('NFD').replace(/[̀-ͯ]/g, '');
const status = (r, esperado) => igual(r.status, esperado, `HTTP (${msgDe(r) || 'sem mensagem'})`);

async function http(metodo, caminho, corpo, token) {
  const cab = {};
  if (corpo !== undefined) cab['Content-Type'] = 'application/json';
  if (token) cab.Authorization = `Bearer ${token}`;
  const resp = await fetch(`${BASE}${caminho}`, { method: metodo, headers: cab, body: corpo !== undefined ? JSON.stringify(corpo) : undefined });
  let data = {};
  try { data = await resp.json(); } catch { /* sem corpo */ }
  return { status: resp.status, data };
}

const dia = (delta) => { const d = new Date(); d.setDate(d.getDate() + delta); return d.toLocaleDateString('en-CA'); };
const agoraLocal = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`; };

async function main() {
  const inicio = agoraLocal();
  const marcador = path.join(__dirname, '.ultimo_teste.json');
  fs.writeFileSync(marcador, JSON.stringify({ inicio }));

  // ───── pré-checagens ─────
  try {
    const raiz = await fetch(`http://localhost:${process.env.PORT || 3000}/`);
    if (!raiz.ok) throw new Error('resposta ' + raiz.status);
  } catch (e) {
    console.error(`Backend não respondeu em localhost:${process.env.PORT || 3000} (${e.message}). Rode "npm run dev" em outro terminal e tente de novo.`);
    process.exit(2);
  }
  if (!ADMIN_SENHA) {
    console.error('Defina TESTE_ADMIN_SENHA no .env do backend (a senha atual do gerente) e rode de novo.');
    process.exit(2);
  }
  const pool = await connectToDatabase();
  const sqlq = async (texto) => (await pool.request().query(texto)).recordset;

  // estado compartilhado
  const E = { tokens: {}, ids: {}, vendas: [], taxasOriginais: null, nichoOriginal: null, caixaAbertoPeloTeste: null };
  let admin, oper;

  try {
    // =====================================================================
    grupo('1. Login e sessão');
    // =====================================================================
    await t('Sem token → 401', async () => { status(await http('GET', '/produtos'), 401); });
    await t('Token inválido → 401', async () => { status(await http('GET', '/produtos', undefined, 'lixo'), 401); });
    await t('Login sem preencher → 400', async () => { status(await http('POST', '/auth/login', { login: '', senha: '' }), 400); });
    await t('Senha errada → 401 com mensagem genérica', async () => {
      const r = await http('POST', '/auth/login', { login: ADMIN_LOGIN, senha: 'senha-errada-xyz' });
      status(r, 401); verdade(/incorretos/i.test(msgSemAcento(r)), 'mensagem inesperada: ' + msgDe(r));
    });
    await t('Usuário inexistente → mesma mensagem da senha errada', async () => {
      const r = await http('POST', '/auth/login', { login: 'zzteste_naoexiste', senha: 'qualquer123' });
      status(r, 401); verdade(/incorretos/i.test(msgSemAcento(r)), 'mensagem diferente: ' + msgDe(r));
    });
    await t('Login do gerente OK', async () => {
      const r = await http('POST', '/auth/login', { login: ADMIN_LOGIN, senha: ADMIN_SENHA });
      status(r, 200);
      verdade(r.data.token && r.data.token.length === 64, 'token deveria ter 64 caracteres');
      verdade(!JSON.stringify(r.data).includes('senha_hash'), 'a resposta vazou o hash da senha');
      igual(r.data.usuario.perfil, 'GERENTE', 'perfil');
      if (r.data.usuario.deve_trocar_senha) throw new Error('O gerente ainda está com senha provisória: entre no sistema, troque a senha e rode de novo.');
      E.tokens.admin = r.data.token; admin = r.data.usuario;
    });
    if (!E.tokens.admin) throw new Error('Sem login de gerente não dá para continuar.');
    const A = E.tokens.admin;

    await t('/auth/me devolve o usuário', async () => {
      const r = await http('GET', '/auth/me', undefined, A); status(r, 200); igual(r.data.usuario.login, ADMIN_LOGIN, 'login');
    });
    await t('6 erros seguidos bloqueiam o login (429)', async () => {
      const codigos = [];
      for (let i = 0; i < 6; i++) codigos.push((await http('POST', '/auth/login', { login: 'zzteste_bloqueio', senha: 'errada123' })).status);
      igual(codigos.slice(0, 5).join(','), '401,401,401,401,401', 'cinco primeiras');
      igual(codigos[5], 429, 'sexta tentativa');
    });
    await t('Logout invalida o token na hora', async () => {
      const l = await http('POST', '/auth/login', { login: ADMIN_LOGIN, senha: ADMIN_SENHA });
      const tk = l.data.token;
      status(await http('GET', '/auth/me', undefined, tk), 200);
      status(await http('POST', '/auth/logout', {}, tk), 200);
      status(await http('GET', '/auth/me', undefined, tk), 401);
    });

    // =====================================================================
    grupo('2. Usuários e troca de senha');
    // =====================================================================
    const loginOper = 'zzteste_oper';
    await t('Gerente cria operador', async () => {
      const r = await http('POST', '/usuarios', { nome: 'ZZTESTE Operadora', login: loginOper, perfil: 'OPERADOR', senha: SENHA_PROVISORIA }, A);
      status(r, 201); E.ids.oper = r.data.id_usuario;
    });
    await t('Login duplicado → 400', async () => {
      const r = await http('POST', '/usuarios', { nome: 'x', login: loginOper, perfil: 'OPERADOR', senha: SENHA_PROVISORIA }, A);
      status(r, 400); verdade(/ja existe/i.test(msgSemAcento(r)), msgDe(r));
    });
    await t('Senha curta → 400', async () => { status(await http('POST', '/usuarios', { nome: 'x', login: 'zzteste_curta', perfil: 'OPERADOR', senha: '123' }, A), 400); });
    await t('Login com espaço/maiúscula → 400', async () => { status(await http('POST', '/usuarios', { nome: 'x', login: 'ZZ Teste', perfil: 'OPERADOR', senha: SENHA_PROVISORIA }, A), 400); });
    await t('Perfil inválido → 400', async () => { status(await http('POST', '/usuarios', { nome: 'x', login: 'zzteste_perfil', perfil: 'DONO', senha: SENHA_PROVISORIA }, A), 400); });
    await t('Senha no banco é hash, nunca o texto', async () => {
      const [u] = await sqlq(`SELECT senha_hash FROM dbo.Usuarios WHERE login = '${loginOper}'`);
      verdade(u.senha_hash.startsWith('scrypt$') && !u.senha_hash.includes(SENHA_PROVISORIA), 'senha_hash fora do padrão');
    });
    await t('Operador entra com senha provisória (deve_trocar_senha)', async () => {
      const r = await http('POST', '/auth/login', { login: loginOper, senha: SENHA_PROVISORIA });
      status(r, 200); igual(r.data.usuario.deve_trocar_senha, true, 'deve_trocar_senha'); E.tokens.oper = r.data.token;
    });
    const O_ = () => E.tokens.oper;
    await t('Com senha provisória, a API só aceita a troca (403 TROCAR_SENHA)', async () => {
      const r = await http('GET', '/produtos', undefined, O_()); status(r, 403); igual(r.data.codigo, 'TROCAR_SENHA', 'codigo');
    });
    await t('Troca com senha atual errada → 400 (e a sessão continua)', async () => {
      status(await http('POST', '/auth/trocar-senha', { senha_atual: 'errada', nova_senha: SENHA_FINAL }, O_()), 400);
      status(await http('GET', '/auth/me', undefined, O_()), 200);
    });
    await t('Nova senha curta → 400', async () => { status(await http('POST', '/auth/trocar-senha', { senha_atual: SENHA_PROVISORIA, nova_senha: '123' }, O_()), 400); });
    await t('Nova senha igual à atual → 400', async () => { status(await http('POST', '/auth/trocar-senha', { senha_atual: SENHA_PROVISORIA, nova_senha: SENHA_PROVISORIA }, O_()), 400); });
    await t('Troca de senha OK libera o acesso', async () => {
      status(await http('POST', '/auth/trocar-senha', { senha_atual: SENHA_PROVISORIA, nova_senha: SENHA_FINAL }, O_()), 200);
      status(await http('GET', '/produtos', undefined, O_()), 200);
    });
    await t('Senha antiga não entra mais; a nova entra', async () => {
      status(await http('POST', '/auth/login', { login: loginOper, senha: SENHA_PROVISORIA }), 401);
      const r = await http('POST', '/auth/login', { login: loginOper, senha: SENHA_FINAL }); status(r, 200); igual(r.data.usuario.deve_trocar_senha, false, 'deve_trocar_senha');
    });
    await t('Gerente não pode desativar nem rebaixar a si mesmo', async () => {
      const me = (await http('GET', '/auth/me', undefined, A)).data.usuario;
      status(await http('PUT', `/usuarios/${me.id_usuario}`, { nome: me.nome, login: me.login, perfil: 'GERENTE', ativo: false }, A), 400);
      status(await http('PUT', `/usuarios/${me.id_usuario}`, { nome: me.nome, login: me.login, perfil: 'OPERADOR', ativo: true }, A), 400);
    });

    // =====================================================================
    grupo('3. Permissões do operador (regras no backend)');
    // =====================================================================
    const permitidos = [['GET', '/produtos'], ['GET', '/clientes'], ['GET', '/caixa/atual'], ['GET', '/configuracoes']];
    const negados = [['GET', '/dashboard'], ['GET', '/vendas'], ['GET', '/despesas'], ['GET', '/usuarios'], ['GET', '/auditoria/estoque'],
      ['GET', '/auditoria/erros'], ['GET', '/analytics/curva-abc'], ['GET', '/taxas'], ['GET', '/orcamentos'], ['GET', '/produtos/1/ficha'],
      ['POST', '/produtos', {}], ['PUT', '/produtos/1', {}], ['DELETE', '/produtos/1'], ['POST', '/produtos/1/entrada', { quantidade: 1 }],
      ['POST', '/clientes', { nome: 'x' }], ['POST', '/despesas', {}], ['PUT', '/configuracoes', { nicho: 'VAREJO' }], ['PUT', '/taxas', { taxas: [] }],
      ['POST', '/vendas/1/cancelar', {}], ['POST', '/usuarios', {}], ['GET', '/rota-que-nao-existe']];
    for (const [m, c] of permitidos) await t(`Operador PODE ${m} ${c}`, async () => { status(await http(m, c, m === 'GET' ? undefined : {}, O_()), 200); });
    for (const [m, c, corpo] of negados) await t(`Operador NÃO PODE ${m} ${c}`, async () => { status(await http(m, c, corpo, O_()), 403); });

    // =====================================================================
    grupo('4. Produtos, estoque e perfil do negócio');
    // =====================================================================
    const criar = async (nome, custo, venda, estoque, minimo = 2, categoria = 'ZZTESTE Categoria') =>
      http('POST', '/produtos', { nome, preco_custo: custo, preco_venda: venda, estoque_inicial: estoque, estoque_minimo: minimo, nome_categoria: categoria }, A);
    const catalogo = async (token = A) => (await http('GET', '/produtos', undefined, token)).data;
    const prod = async (nome) => (await catalogo()).find(p => p.Produto === nome);
    const estoqueDe = async (nome) => (await prod(nome)).estoque_atual;

    const NOMES = { A: 'ZZTESTE Produto A', B: 'ZZTESTE Produto B', ING1: 'ZZTESTE Farinha', ING2: 'ZZTESTE Ovo', BOLO: 'ZZTESTE Bolo', TORTA: 'ZZTESTE Torta', PARADO: 'ZZTESTE Parado' };
    await t('Cadastrar produtos de teste', async () => {
      for (const [nome, c, v, e, m] of [[NOMES.A, 10, 25, 10, 2], [NOMES.B, 5, 12, 3, 1], [NOMES.ING1, 1, 2, 100, 10], [NOMES.ING2, 2, 3, 100, 10], [NOMES.BOLO, 0, 40, 0, 5], [NOMES.TORTA, 0, 60, 0, 5], [NOMES.PARADO, 3, 6, 5, 1]]) {
        status(await criar(nome, c, v, e, m), 201);
      }
      for (const k of Object.keys(NOMES)) { const p = await prod(NOMES[k]); verdade(p, `produto ${NOMES[k]} não apareceu no catálogo`); E.ids[k] = p.id_produto; E['cb' + k] = p.codigo_barras; }
    });
    await t('Código de barras interno gerado (13 dígitos, começa com 200)', async () => { verdade(/^200\d{10}$/.test(E.cbA), 'código: ' + E.cbA); });
    await t('Categoria criada automaticamente', async () => { igual((await prod(NOMES.A)).Categoria, 'ZZTESTE Categoria', 'categoria'); });
    await t('Preço negativo → 400', async () => { status(await criar('ZZTESTE Ruim', 1, -5, 1), 400); });
    await t('Nome vazio → 400', async () => { status(await criar('   ', 1, 5, 1), 400); });
    await t('Estoque negativo → 400', async () => { status(await criar('ZZTESTE Ruim2', 1, 5, -3), 400); });
    await t('Código de barras duplicado → 400', async () => {
      const r = await http('POST', '/produtos', { nome: 'ZZTESTE Dup', preco_custo: 1, preco_venda: 2, estoque_inicial: 1, estoque_minimo: 1, codigo_barras: E.cbA }, A);
      status(r, 400); verdade(/codigo de barras/i.test(msgSemAcento(r)), msgDe(r));
    });
    await t('Operador NÃO recebe preco_custo; gerente recebe', async () => {
      const deOper = (await catalogo(O_())).find(p => p.Produto === NOMES.A);
      const deGerente = await prod(NOMES.A);
      verdade(deOper && !('preco_custo' in deOper), 'o operador recebeu o custo!');
      igual(Number(deGerente.preco_custo), 10, 'custo para o gerente');
    });
    await t('Repor estoque (+5) soma ao saldo', async () => {
      const antes = await estoqueDe(NOMES.B);
      const r = await http('POST', `/produtos/${E.ids.B}/entrada`, { quantidade: 5, motivo: 'ZZTESTE reposicao' }, A); status(r, 200);
      igual(await estoqueDe(NOMES.B), antes + 5, 'estoque');
    });
    await t('Reposição com quantidade 0 ou negativa → 400', async () => {
      status(await http('POST', `/produtos/${E.ids.B}/entrada`, { quantidade: 0 }, A), 400);
      status(await http('POST', `/produtos/${E.ids.B}/entrada`, { quantidade: -2 }, A), 400);
    });
    await t('Repor produto inexistente → 400', async () => { status(await http('POST', '/produtos/99999999/entrada', { quantidade: 1 }, A), 400); });
    await t('Editar produto (preço) e estoque não muda', async () => {
      const antes = await estoqueDe(NOMES.B);
      status(await http('PUT', `/produtos/${E.ids.B}`, { nome: NOMES.B, preco_custo: 5, preco_venda: 12, estoque_minimo: 1, nome_categoria: 'ZZTESTE Categoria' }, A), 200);
      igual(await estoqueDe(NOMES.B), antes, 'estoque após editar');
    });
    await t('Editar com preço negativo → 400', async () => {
      status(await http('PUT', `/produtos/${E.ids.B}`, { nome: NOMES.B, preco_custo: -1, preco_venda: 12, estoque_minimo: 1 }, A), 400);
    });
    await t('Perfil do negócio: troca para ALIMENTACAO e valida valor inválido', async () => {
      E.nichoOriginal = (await http('GET', '/configuracoes', undefined, A)).data.nicho;
      status(await http('PUT', '/configuracoes', { nicho: 'XPTO' }, A), 400);
      status(await http('PUT', '/configuracoes', { nicho: 'ALIMENTACAO' }, A), 200);
      igual((await http('GET', '/configuracoes', undefined, O_())).data.nicho, 'ALIMENTACAO', 'nicho lido pelo operador');
    });

    // =====================================================================
    grupo('5. Caixa');
    // =====================================================================
    await t('Consultar / abrir o caixa', async () => {
      const atual = await http('GET', '/caixa/atual', undefined, O_()); status(atual, 200);
      if (atual.data.id_caixa) { E.ids.caixa = atual.data.id_caixa; console.log(`      (já havia o caixa #${E.ids.caixa} aberto: será usado e NÃO será fechado)`); return; }
      status(await http('POST', '/caixa/abrir', { troco_inicial: -5 }, O_()), 400);
      const r = await http('POST', '/caixa/abrir', { troco_inicial: 100 }, O_()); status(r, 201);
      E.ids.caixa = r.data.id_caixa; E.caixaAbertoPeloTeste = r.data.id_caixa;
      fs.writeFileSync(marcador, JSON.stringify({ inicio, caixaId: E.caixaAbertoPeloTeste }));
    });
    await t('Abrir um segundo caixa → 400', async () => {
      const r = await http('POST', '/caixa/abrir', { troco_inicial: 10 }, O_()); status(r, 400); verdade(/ja existe um caixa aberto/i.test(msgSemAcento(r)), msgDe(r));
    });
    verdade(E.ids.caixa, 'sem caixa aberto não dá para testar vendas');
    const CX = E.ids.caixa;

    // =====================================================================
    grupo('6. Vendas: PIX, pagamento misto, taxas e erros');
    // =====================================================================
    const vender = (token, itens, pagamentos, extra = {}) => http('POST', '/vendas', { id_caixa: CX, valor_desconto: 0, itens, pagamentos, ...extra }, token);
    const item = (cb, q) => ({ codigo_barras: cb, quantidade: q });

    await t('Taxas: salvar débito 2% e crédito 4% (originais serão restauradas)', async () => {
      E.taxasOriginais = (await http('GET', '/taxas', undefined, A)).data;
      verdade(E.taxasOriginais.length >= 6, 'esperava 6 formas de pagamento');
      status(await http('PUT', '/taxas', { taxas: [{ forma_pagamento: 'DINHEIRO', taxa_percentual: 0 }, { forma_pagamento: 'PIX', taxa_percentual: 0 }, { forma_pagamento: 'CARTAO_DEBITO', taxa_percentual: 2 }, { forma_pagamento: 'CARTAO_CREDITO', taxa_percentual: 4 }] }, A), 200);
      status(await http('PUT', '/taxas', { taxas: [{ forma_pagamento: 'PIX', taxa_percentual: 150 }] }, A), 400);
      status(await http('PUT', '/taxas', { taxas: [{ forma_pagamento: 'BITCOIN', taxa_percentual: 1 }] }, A), 400);
    });
    await t('Venda 1 (operador): 2x A, PIX R$ 50', async () => {
      const antes = await estoqueDe(NOMES.A);
      const r = await vender(O_(), [item(E.cbA, 2)], [{ forma_pagamento: 'PIX', valor_pago: 50 }]); status(r, 201);
      E.ids.v1 = r.data.id_venda; E.vendas.push(E.ids.v1);
      igual(await estoqueDe(NOMES.A), antes - 2, 'estoque de A');
    });
    await t('Recibo da venda 1: total, itens e Pix', async () => {
      const r = await http('GET', `/vendas/${E.ids.v1}/recibo`, undefined, O_()); status(r, 200);
      perto(r.data.venda.valor_a_receber, 50, 'valor a receber'); igual(r.data.itens.length, 1, 'itens'); igual(r.data.tem_pix, true, 'tem_pix'); perto(r.data.valor_pix, 50, 'valor_pix');
      if (r.data.pix) {
        verdade(r.data.pix.payload.startsWith('000201'), 'payload Pix não começa com 000201');
        verdade(r.data.pix.payload.includes('540550.00'), 'payload Pix sem o valor 50.00');
      } else console.log('      (Pix não configurado no .env: QR Code não testado)');
    });
    await t('Venda 2: A + B, desconto R$ 7, dinheiro 10 + crédito 20', async () => {
      const r = await vender(O_(), [item(E.cbA, 1), item(E.cbB, 1)], [{ forma_pagamento: 'DINHEIRO', valor_pago: 10 }, { forma_pagamento: 'CARTAO_CREDITO', valor_pago: 20 }], { valor_desconto: 7 });
      status(r, 201); E.ids.v2 = r.data.id_venda; E.vendas.push(E.ids.v2);
      const [v] = await sqlq(`SELECT valor_total, valor_desconto FROM dbo.Vendas WHERE id_venda = ${E.ids.v2}`);
      perto(v.valor_total, 37, 'valor_total'); perto(v.valor_desconto, 7, 'desconto');
    });
    await t('Taxa de 4% gravada no pagamento de crédito (R$ 0,80) e 0 no dinheiro', async () => {
      const pg = await sqlq(`SELECT forma_pagamento, taxa_percentual, valor_taxa FROM dbo.PagamentosVenda WHERE id_venda = ${E.ids.v2}`);
      const cred = pg.find(p => p.forma_pagamento === 'CARTAO_CREDITO'); const din = pg.find(p => p.forma_pagamento === 'DINHEIRO');
      perto(cred.taxa_percentual, 4, 'taxa %'); perto(cred.valor_taxa, 0.8, 'valor da taxa'); perto(din.valor_taxa, 0, 'taxa do dinheiro');
    });
    await t('Mudar a taxa depois NÃO altera a venda antiga', async () => {
      status(await http('PUT', '/taxas', { taxas: [{ forma_pagamento: 'CARTAO_CREDITO', taxa_percentual: 10 }] }, A), 200);
      const [p] = await sqlq(`SELECT valor_taxa FROM dbo.PagamentosVenda WHERE id_venda = ${E.ids.v2} AND forma_pagamento = 'CARTAO_CREDITO'`);
      perto(p.valor_taxa, 0.8, 'taxa congelada');
    });
    await t('Histórico de estoque registra QUEM vendeu', async () => {
      const h = await sqlq(`SELECT usuario_responsavel, tipo_movimento, quantidade, estoque_resultante FROM dbo.Historico_Movimentacao_Estoque WHERE id_venda = ${E.ids.v1}`);
      verdade(h.length === 1, 'esperava 1 movimento'); igual(h[0].usuario_responsavel, loginOper, 'usuario'); igual(h[0].tipo_movimento, 'SAIDA', 'tipo'); verdade(h[0].estoque_resultante != null, 'estoque_resultante vazio');
    });
    await t('Estoque insuficiente → 400 e NADA é gravado', async () => {
      const antes = await estoqueDe(NOMES.B); const [n0] = await sqlq(`SELECT COUNT(*) n FROM dbo.Vendas`);
      const r = await vender(O_(), [item(E.cbA, 1), item(E.cbB, 99)], [{ forma_pagamento: 'PIX', valor_pago: 1213 }]);
      status(r, 400); verdade(/insuficiente/i.test(msgSemAcento(r)), msgDe(r));
      igual(await estoqueDe(NOMES.B), antes, 'estoque de B'); const [n1] = await sqlq(`SELECT COUNT(*) n FROM dbo.Vendas`); igual(n1.n, n0.n, 'nº de vendas');
    });
    await t('Pagamento diferente do total → 400', async () => {
      const r = await vender(O_(), [item(E.cbA, 1)], [{ forma_pagamento: 'PIX', valor_pago: 1 }]); status(r, 400); verdade(/pagamentos/i.test(msgSemAcento(r)), msgDe(r));
    });
    await t('Desconto maior que o total → 400', async () => { status(await vender(O_(), [item(E.cbA, 1)], [{ forma_pagamento: 'PIX', valor_pago: 25 }], { valor_desconto: 100 }), 400); });
    await t('Desconto negativo → 400', async () => { status(await vender(O_(), [item(E.cbA, 1)], [{ forma_pagamento: 'PIX', valor_pago: 25 }], { valor_desconto: -5 }), 400); });
    await t('Código de barras inexistente → 400', async () => { status(await vender(O_(), [item('9999999999999', 1)], [{ forma_pagamento: 'PIX', valor_pago: 1 }]), 400); });
    await t('Sem itens / sem pagamento / quantidade 0 → 400', async () => {
      status(await vender(O_(), [], [{ forma_pagamento: 'PIX', valor_pago: 1 }]), 400);
      status(await vender(O_(), [item(E.cbA, 1)], []), 400);
      status(await vender(O_(), [item(E.cbA, 0)], [{ forma_pagamento: 'PIX', valor_pago: 1 }]), 400);
    });
    await t('Forma de pagamento inválida → falha e não grava', async () => {
      const [n0] = await sqlq(`SELECT COUNT(*) n FROM dbo.Vendas`);
      const r = await vender(O_(), [item(E.cbA, 1)], [{ forma_pagamento: 'BITCOIN', valor_pago: 25 }]);
      verdade(r.status >= 400, 'deveria falhar'); const [n1] = await sqlq(`SELECT COUNT(*) n FROM dbo.Vendas`); igual(n1.n, n0.n, 'nº de vendas');
    });
    await t('Caixa inexistente → 400', async () => { status(await http('POST', '/vendas', { id_caixa: 99999999, itens: [item(E.cbA, 1)], pagamentos: [{ forma_pagamento: 'PIX', valor_pago: 25 }] }, O_()), 400); });
    await t('O erro de venda ficou no Log_Erros (gerente vê)', async () => {
      const r = await http('GET', '/auditoria/erros', undefined, A); status(r, 200);
      verdade(r.data.some(e => /insuficiente/i.test(e.mensagem)), 'não achei o erro "Estoque insuficiente" no log');
    });

    // =====================================================================
    grupo('7. Cancelamento de venda');
    // =====================================================================
    await t('Operador não pode cancelar (403)', async () => { status(await http('POST', `/vendas/${E.ids.v1}/cancelar`, { motivo: 'x' }, O_()), 403); });
    await t('Histórico de vendas lista as vendas do teste', async () => {
      const r = await http('GET', '/vendas?limite=50', undefined, A); status(r, 200);
      verdade(r.data.some(v => v.id_venda === E.ids.v1) && r.data.some(v => v.id_venda === E.ids.v2), 'vendas não apareceram');
    });
    await t('Gerente cancela a venda 1: itens voltam ao estoque', async () => {
      const antes = await estoqueDe(NOMES.A);
      status(await http('POST', `/vendas/${E.ids.v1}/cancelar`, { motivo: 'ZZTESTE cliente desistiu' }, A), 200);
      igual(await estoqueDe(NOMES.A), antes + 2, 'estoque de A');
      const [v] = await sqlq(`SELECT status_venda, motivo_cancelamento FROM dbo.Vendas WHERE id_venda = ${E.ids.v1}`);
      igual(v.status_venda, 'CANCELADA', 'status'); verdade(/desistiu/.test(v.motivo_cancelamento), 'motivo não gravado');
    });
    await t('Estorno aparece na auditoria com o gerente como autor', async () => {
      const h = await sqlq(`SELECT usuario_responsavel FROM dbo.Historico_Movimentacao_Estoque WHERE id_venda = ${E.ids.v1} AND tipo_movimento = 'ENTRADA'`);
      verdade(h.length === 1, 'estorno não registrado'); igual(h[0].usuario_responsavel, ADMIN_LOGIN, 'autor');
    });
    await t('Cancelar de novo → 400', async () => { const r = await http('POST', `/vendas/${E.ids.v1}/cancelar`, {}, A); status(r, 400); verdade(/ja foi cancelada/i.test(msgSemAcento(r)), msgDe(r)); });
    await t('Cancelar venda inexistente → 400', async () => { status(await http('POST', '/vendas/99999999/cancelar', {}, A), 400); });
    await t('Recibo de venda cancelada mostra o status', async () => { igual((await http('GET', `/vendas/${E.ids.v1}/recibo`, undefined, A)).data.venda.status_venda, 'CANCELADA', 'status'); });

    // =====================================================================
    grupo('8. Ficha técnica (receitas)');
    // =====================================================================
    await t('Montar a receita do bolo: 5 farinha + 4 ovos', async () => {
      status(await http('PUT', `/produtos/${E.ids.BOLO}/ficha`, { ingredientes: [{ id_ingrediente: E.ids.ING1, quantidade: 5 }, { id_ingrediente: E.ids.ING2, quantidade: 4 }] }, A), 200);
      const f = await http('GET', `/produtos/${E.ids.BOLO}/ficha`, undefined, A); igual(f.data.length, 2, 'ingredientes');
      igual((await prod(NOMES.BOLO)).tem_ficha, true, 'tem_ficha no catálogo');
    });
    await t('Produto como ingrediente dele mesmo → 400', async () => { status(await http('PUT', `/produtos/${E.ids.BOLO}/ficha`, { ingredientes: [{ id_ingrediente: E.ids.BOLO, quantidade: 1 }] }, A), 400); });
    await t('Ingrediente que já tem receita própria → 400', async () => {
      const r = await http('PUT', `/produtos/${E.ids.TORTA}/ficha`, { ingredientes: [{ id_ingrediente: E.ids.BOLO, quantidade: 1 }] }, A); status(r, 400); verdade(/ficha tecnica/i.test(msgSemAcento(r)), msgDe(r));
    });
    await t('Quantidade 0 ou ingrediente inexistente → 400', async () => {
      status(await http('PUT', `/produtos/${E.ids.TORTA}/ficha`, { ingredientes: [{ id_ingrediente: E.ids.ING1, quantidade: 0 }] }, A), 400);
      status(await http('PUT', `/produtos/${E.ids.TORTA}/ficha`, { ingredientes: [{ id_ingrediente: 99999999, quantidade: 1 }] }, A), 400);
    });
    await t('Vender 2 bolos baixa os INGREDIENTES (−10 farinha, −8 ovos), não o bolo', async () => {
      const f0 = await estoqueDe(NOMES.ING1), o0 = await estoqueDe(NOMES.ING2);
      const r = await vender(A, [item(E.cbBOLO, 2)], [{ forma_pagamento: 'PIX', valor_pago: 80 }]); status(r, 201); E.ids.v3 = r.data.id_venda; E.vendas.push(E.ids.v3);
      igual(await estoqueDe(NOMES.ING1), f0 - 10, 'farinha'); igual(await estoqueDe(NOMES.ING2), o0 - 8, 'ovos'); igual(await estoqueDe(NOMES.BOLO), 0, 'estoque do bolo');
    });
    await t('Custo da venda = custo da receita (5×1 + 4×2 = R$ 13 por bolo)', async () => {
      const [i] = await sqlq(`SELECT preco_custo_momento FROM dbo.ItensVenda WHERE id_venda = ${E.ids.v3}`); perto(i.preco_custo_momento, 13, 'custo da receita');
    });
    await t('Bolo (com receita) não aparece como "para repor" no dashboard', async () => {
      const r = await http('GET', '/dashboard', undefined, A); verdade(!r.data.alertas.some(a => a.Produto === NOMES.BOLO), 'o bolo apareceu em alertas');
    });
    await t('Cancelar a venda devolve os ingredientes', async () => {
      const f0 = await estoqueDe(NOMES.ING1), o0 = await estoqueDe(NOMES.ING2);
      status(await http('POST', `/vendas/${E.ids.v3}/cancelar`, { motivo: 'ZZTESTE' }, A), 200);
      igual(await estoqueDe(NOMES.ING1), f0 + 10, 'farinha'); igual(await estoqueDe(NOMES.ING2), o0 + 8, 'ovos');
    });
    await t('Falta de ingrediente barra a venda e diz qual', async () => {
      const grande = (await estoqueDe(NOMES.ING1)); // 100 -> 21 bolos exigem 105 farinhas
      const r = await vender(A, [item(E.cbBOLO, Math.floor(grande / 5) + 1)], [{ forma_pagamento: 'PIX', valor_pago: 40 * (Math.floor(grande / 5) + 1) }]);
      status(r, 400); verdade(/Farinha/.test(msgSemAcento(r)), msgDe(r));
    });
    await t('Remover a receita (lista vazia)', async () => {
      status(await http('PUT', `/produtos/${E.ids.TORTA}/ficha`, { ingredientes: [] }, A), 200);
    });

    // =====================================================================
    grupo('9. Clientes (CRM)');
    // =====================================================================
    const cpf = `9${RODADA}`.padEnd(11, '1').slice(0, 11);
    await t('Cadastrar cliente (WhatsApp formatado vira só números)', async () => {
      const r = await http('POST', '/clientes', { nome: 'ZZTESTE Cliente', whatsapp: '(11) 91234-5678', documento: cpf, observacoes: 'cliente do teste' }, A); status(r, 201); E.ids.cli = r.data.id_cliente;
      const l = (await http('GET', '/clientes', undefined, A)).data.find(c => c.id_cliente === E.ids.cli); igual(l.whatsapp, '11912345678', 'whatsapp'); igual(l.qtd_compras, 0, 'compras');
    });
    await t('WhatsApp inválido → 400', async () => { status(await http('POST', '/clientes', { nome: 'ZZTESTE Ruim', whatsapp: '123' }, A), 400); });
    await t('CPF duplicado → 400', async () => { status(await http('POST', '/clientes', { nome: 'ZZTESTE Outro', documento: cpf }, A), 400); });
    await t('Nome vazio → 400', async () => { status(await http('POST', '/clientes', { nome: '  ' }, A), 400); });
    await t('Editar cliente', async () => {
      status(await http('PUT', `/clientes/${E.ids.cli}`, { nome: 'ZZTESTE Cliente Editado', whatsapp: '11912345678', documento: cpf }, A), 200);
      verdade((await http('GET', '/clientes', undefined, A)).data.some(c => c.nome === 'ZZTESTE Cliente Editado'), 'nome não mudou');
    });
    await t('Venda com cliente: recibo traz o nome e o histórico do cliente soma', async () => {
      const r = await vender(O_(), [item(E.cbA, 1)], [{ forma_pagamento: 'CARTAO_DEBITO', valor_pago: 25 }], { id_cliente: E.ids.cli }); status(r, 201); E.ids.v4 = r.data.id_venda; E.vendas.push(E.ids.v4);
      const rec = await http('GET', `/vendas/${E.ids.v4}/recibo`, undefined, O_()); igual(rec.data.cliente.nome, 'ZZTESTE Cliente Editado', 'cliente no recibo'); igual(rec.data.cliente.whatsapp, '11912345678', 'whatsapp no recibo');
      const h = await http('GET', `/clientes/${E.ids.cli}/historico`, undefined, A); igual(h.data.resumo.qtd_compras, 1, 'compras'); perto(h.data.resumo.total_gasto, 25, 'total gasto');
    });
    await t('Venda com cliente inexistente → 400', async () => { status(await vender(O_(), [item(E.cbA, 1)], [{ forma_pagamento: 'PIX', valor_pago: 25 }], { id_cliente: 99999999 }), 400); });

    // =====================================================================
    grupo('10. Orçamentos');
    // =====================================================================
    await t('Criar orçamento (A + B − R$ 2 = R$ 35) NÃO baixa estoque', async () => {
      const a0 = await estoqueDe(NOMES.A), b0 = await estoqueDe(NOMES.B);
      const r = await http('POST', '/orcamentos', { id_cliente: E.ids.cli, validade: dia(7), valor_desconto: 2, observacoes: 'ZZTESTE', itens: [item(E.cbA, 1), item(E.cbB, 1)] }, A); status(r, 201); E.ids.orc = r.data.id_orcamento;
      igual(await estoqueDe(NOMES.A), a0, 'estoque A'); igual(await estoqueDe(NOMES.B), b0, 'estoque B');
      const d = await http('GET', `/orcamentos/${E.ids.orc}`, undefined, A); perto(d.data.orcamento.valor_a_receber, 35, 'valor'); igual(d.data.orcamento.situacao, 'ABERTO', 'situação'); igual(d.data.itens.length, 2, 'itens');
    });
    await t('Validade no passado → 400', async () => { status(await http('POST', '/orcamentos', { validade: dia(-1), itens: [item(E.cbA, 1)] }, A), 400); });
    await t('Orçamento sem itens / desconto maior que o total → 400', async () => {
      status(await http('POST', '/orcamentos', { itens: [] }, A), 400);
      status(await http('POST', '/orcamentos', { valor_desconto: 999, itens: [item(E.cbA, 1)] }, A), 400);
    });
    await t('Converter em venda removendo o item B (cliente desistiu): orçamento vira CONVERTIDO', async () => {
      const r = await vender(O_(), [item(E.cbA, 1)], [{ forma_pagamento: 'PIX', valor_pago: 25 }], { id_cliente: E.ids.cli, id_orcamento: E.ids.orc }); status(r, 201); E.ids.v5 = r.data.id_venda; E.vendas.push(E.ids.v5);
      const d = await http('GET', `/orcamentos/${E.ids.orc}`, undefined, A); igual(d.data.orcamento.situacao, 'CONVERTIDO', 'situação'); igual(d.data.orcamento.id_venda, E.ids.v5, 'id_venda');
    });
    await t('Converter o mesmo orçamento de novo → 400', async () => { status(await vender(O_(), [item(E.cbA, 1)], [{ forma_pagamento: 'PIX', valor_pago: 25 }], { id_orcamento: E.ids.orc }), 400); });
    await t('Cancelar orçamento em aberto; cancelar de novo → 400', async () => {
      const r = await http('POST', '/orcamentos', { itens: [item(E.cbB, 1)] }, A); status(r, 201);
      status(await http('POST', `/orcamentos/${r.data.id_orcamento}/cancelar`, {}, A), 200);
      status(await http('POST', `/orcamentos/${r.data.id_orcamento}/cancelar`, {}, A), 400);
    });
    await t('Orçamento vencido não vira venda (validade vencida via banco)', async () => {
      const r = await http('POST', '/orcamentos', { validade: dia(1), itens: [item(E.cbB, 1)] }, A); status(r, 201);
      await sqlq(`UPDATE dbo.Orcamentos SET validade = DATEADD(DAY, -3, CAST(SYSDATETIME() AS DATE)) WHERE id_orcamento = ${r.data.id_orcamento}`);
      const d = await http('GET', `/orcamentos/${r.data.id_orcamento}`, undefined, A); igual(d.data.orcamento.situacao, 'EXPIRADO', 'situação');
      const v = await vender(O_(), [item(E.cbB, 1)], [{ forma_pagamento: 'PIX', valor_pago: 12 }], { id_orcamento: r.data.id_orcamento }); status(v, 400); verdade(/vencido/i.test(msgSemAcento(v)), msgDe(v));
    });
    await t('Operador não acessa orçamentos (403)', async () => { status(await http('GET', '/orcamentos', undefined, O_()), 403); });

    // =====================================================================
    grupo('11. Contas a pagar');
    // =====================================================================
    await t('Lançar conta pendente vencida ontem → situação ATRASADA', async () => {
      const r = await http('POST', '/despesas', { descricao: 'ZZTESTE Boleto', valor_total: 150, data_vencimento: dia(-1), pago: false }, A); status(r, 201); E.ids.desp = r.data.id_despesa;
      const c = (await http('GET', '/despesas', undefined, A)).data.find(d => d.id_despesa === E.ids.desp); igual(c.status_pagamento, 'PENDENTE', 'status'); igual(c.situacao, 'ATRASADA', 'situação'); igual(c.dias_para_vencer, -1, 'dias');
    });
    await t('Conta atrasada aparece no dashboard', async () => {
      const r = await http('GET', '/dashboard', undefined, A); const a = r.data.contas.resumo.find(x => x.situacao === 'ATRASADA'); verdade(a && a.qtd >= 1, 'sem contas atrasadas no dashboard');
    });
    await t('Conta que vence hoje → VENCE HOJE; a vencer → A VENCER', async () => {
      const h = await http('POST', '/despesas', { descricao: 'ZZTESTE Hoje', valor_total: 10, data_vencimento: dia(0), pago: false }, A);
      const f = await http('POST', '/despesas', { descricao: 'ZZTESTE Futura', valor_total: 10, data_vencimento: dia(10), pago: false }, A);
      const lista = (await http('GET', '/despesas', undefined, A)).data;
      igual(lista.find(d => d.id_despesa === h.data.id_despesa).situacao, 'VENCE HOJE', 'hoje'); igual(lista.find(d => d.id_despesa === f.data.id_despesa).situacao, 'A VENCER', 'futura');
    });
    await t('Dar baixa → PAGA; baixa de novo → 400', async () => {
      status(await http('POST', `/despesas/${E.ids.desp}/pagar`, {}, A), 200);
      igual((await http('GET', '/despesas', undefined, A)).data.find(d => d.id_despesa === E.ids.desp).situacao, 'PAGA', 'situação');
      const r = await http('POST', `/despesas/${E.ids.desp}/pagar`, {}, A); status(r, 400); verdade(/ja esta paga/i.test(msgSemAcento(r)), msgDe(r));
    });
    await t('Despesa já paga na hora; valor 0 e descrição vazia → 400', async () => {
      status(await http('POST', '/despesas', { descricao: 'ZZTESTE Paga na hora', valor_total: 20 }, A), 201);
      status(await http('POST', '/despesas', { descricao: 'ZZTESTE Zero', valor_total: 0 }, A), 400);
      status(await http('POST', '/despesas', { descricao: '  ', valor_total: 5 }, A), 400);
    });
    await t('Baixa em conta inexistente → 400', async () => { status(await http('POST', '/despesas/99999999/pagar', {}, A), 400); });

    // =====================================================================
    grupo('12. Dashboard, DRE e Análises');
    // =====================================================================
    await t('Dashboard devolve todas as seções', async () => {
      const r = await http('GET', '/dashboard', undefined, A); status(r, 200);
      for (const k of ['resumo', 'dre', 'alertas', 'movimentacoes', 'contas']) verdade(k in r.data, `faltou "${k}"`);
      verdade(typeof r.data.resumo.faturamento === 'number', 'faturamento não é número');
    });
    await t('DRE do mês: lucro = faturamento − custo − despesas − taxas', async () => {
      const r = await http('GET', '/dashboard', undefined, A); const mes = r.data.dre[0];
      verdade(mes, 'sem linha na DRE');
      perto(mes.Lucro_Liquido, mes.Faturamento_Real_Recebido - mes.Custo_Produtos - mes.Despesas_Operacionais - mes.Taxas_Pagamento, 'lucro líquido');
      verdade(mes.Taxas_Pagamento >= 0.8, 'a taxa de R$ 0,80 do teste não entrou na DRE');
    });
    await t('Venda cancelada não conta na DRE', async () => {
      const [r] = await sqlq(`SELECT SUM(valor_total - valor_desconto) AS f FROM dbo.Vendas WHERE status_venda = 'CONCLUIDA' AND CONVERT(CHAR(7), data_venda, 23) = CONVERT(CHAR(7), SYSDATETIME(), 23)`);
      const d = (await http('GET', '/dashboard', undefined, A)).data.dre.find(x => x.Mes === new Date().toLocaleDateString('en-CA').slice(0, 7));
      perto(d.Faturamento_Real_Recebido, r.f, 'faturamento do mês');
    });
    await t('Curva ABC: classes A/B/C, % acumulado chega a 100', async () => {
      const r = await http('GET', '/analytics/curva-abc?dias=30', undefined, A); status(r, 200); verdade(r.data.length > 0, 'vazia');
      verdade(r.data.every(x => ['A', 'B', 'C'].includes(x.classe)), 'classe inválida');
      const ultimo = r.data[r.data.length - 1]; if (r.data.some(x => x.lucro > 0)) perto(ultimo.pct_acumulado, 100, '% acumulado final', 0.2);
      verdade(r.data.some(x => x.produto === NOMES.A), 'produto A não aparece');
    });
    await t('Curva ABC: janela inválida volta ao padrão (sem erro)', async () => { status(await http('GET', '/analytics/curva-abc?dias=abc', undefined, A), 200); status(await http('GET', '/analytics/curva-abc?dias=-5', undefined, A), 200); });
    await t('Estoque parado: produto envelhecido (60 dias) aparece com capital parado', async () => {
      await sqlq(`UPDATE dbo.Produtos SET data_cadastro = DATEADD(DAY, -60, SYSDATETIME()) WHERE id_produto = ${E.ids.PARADO}`);
      const r = await http('GET', '/analytics/estoque-parado?dias=30', undefined, A); status(r, 200);
      const p = r.data.find(x => x.produto === NOMES.PARADO); verdade(p, 'produto parado não apareceu'); verdade(p.dias_parado >= 59, 'dias_parado: ' + p.dias_parado); perto(p.capital_parado, 15, 'capital parado (5 × R$ 3)');
      verdade(!r.data.some(x => x.produto === NOMES.A), 'produto A (vendido hoje) não deveria estar parado');
    });
    await t('Picos de venda: dia 0–6 e hora 0–23', async () => {
      const r = await http('GET', '/analytics/picos?dias=30', undefined, A); status(r, 200); verdade(r.data.length > 0, 'vazio');
      verdade(r.data.every(x => x.dia_semana_num >= 0 && x.dia_semana_num <= 6 && x.hora >= 0 && x.hora <= 23), 'valor fora da faixa');
    });
    await t('Auditoria de estoque: filtro por tipo e autor', async () => {
      const todos = await http('GET', '/auditoria/estoque?dias=1', undefined, A); status(todos, 200);
      verdade(todos.data.some(m => m.usuario_responsavel === loginOper), 'nenhum movimento do operador');
      verdade(todos.data.some(m => m.usuario_responsavel === ADMIN_LOGIN && /Estorno/i.test(m.motivo)), 'nenhum estorno do gerente');
      const so = await http('GET', '/auditoria/estoque?dias=1&tipo=ENTRADA', undefined, A); verdade(so.data.length > 0 && so.data.every(m => m.tipo_movimento === 'ENTRADA'), 'filtro ENTRADA falhou');
    });

    // =====================================================================
    grupo('13. Inativar produto e desativar usuário');
    // =====================================================================
    await t('Inativar produto: some do catálogo; inativar de novo → 400', async () => {
      status(await http('DELETE', `/produtos/${E.ids.PARADO}`, undefined, A), 200);
      verdade(!(await catalogo()).some(p => p.Produto === NOMES.PARADO), 'ainda aparece no catálogo');
      status(await http('DELETE', `/produtos/${E.ids.PARADO}`, undefined, A), 400);
    });
    await t('Produto inativo não vende (400)', async () => { status(await vender(A, [item(E.cbPARADO, 1)], [{ forma_pagamento: 'PIX', valor_pago: 6 }]), 400); });

    // =====================================================================
    grupo('14. Fechamento de caixa e conciliação');
    // =====================================================================
    if (E.caixaAbertoPeloTeste) {
      await t('Fechar o caixa: faturamento, taxas e líquido conferem', async () => {
        const [soma] = await sqlq(`SELECT SUM(P.valor_pago) f, SUM(P.valor_taxa) tx FROM dbo.PagamentosVenda P JOIN dbo.Vendas V ON V.id_venda = P.id_venda WHERE V.id_caixa = ${CX} AND V.status_venda = 'CONCLUIDA'`);
        const r = await http('POST', '/caixa/fechar', { id_caixa: CX }, O_()); status(r, 200);
        const res = r.data.resumo[0]; perto(res.Faturamento_Total, soma.f, 'faturamento'); perto(res.Taxas_Total, soma.tx, 'taxas'); perto(res.Faturamento_Liquido, soma.f - soma.tx, 'líquido');
        perto(res.Taxas_Total, 0.8, 'taxas (esperado só os R$ 0,80 do crédito)');
        const cred = r.data.formas.find(f => f.forma_pagamento === 'CARTAO_CREDITO'); verdade(cred, 'conciliação sem crédito'); perto(cred.valor_taxa, 0.8, 'taxa do crédito'); perto(cred.valor_liquido, 19.2, 'líquido do crédito');
        const pix = r.data.formas.find(f => f.forma_pagamento === 'PIX'); verdade(pix, 'conciliação sem Pix');
      });
      await t('Fechar de novo → 400', async () => { status(await http('POST', '/caixa/fechar', { id_caixa: CX }, O_()), 400); });
      await t('Vender em caixa fechado → 400', async () => { const r = await vender(O_(), [item(E.cbA, 1)], [{ forma_pagamento: 'PIX', valor_pago: 25 }]); status(r, 400); verdade(/fechado/i.test(msgSemAcento(r)), msgDe(r)); });
      await t('Cancelar venda de caixa fechado → 400', async () => { const r = await http('POST', `/vendas/${E.ids.v2}/cancelar`, {}, A); status(r, 400); verdade(/fechado/i.test(msgSemAcento(r)), msgDe(r)); });
    } else {
      console.log('  (caixa já estava aberto antes do teste: fechamento NÃO testado para não encerrar o seu turno real)');
    }

    // =====================================================================
    grupo('15. Desativar usuário derruba a sessão');
    // =====================================================================
    await t('Desativar o operador: sessão cai (401) e login é negado', async () => {
      const tk = (await http('POST', '/auth/login', { login: loginOper, senha: SENHA_FINAL })).data.token; status(await http('GET', '/auth/me', undefined, tk), 200);
      status(await http('PUT', `/usuarios/${E.ids.oper}`, { nome: 'ZZTESTE Operadora', login: loginOper, perfil: 'OPERADOR', ativo: false }, A), 200);
      status(await http('GET', '/auth/me', undefined, tk), 401); status(await http('POST', '/auth/login', { login: loginOper, senha: SENHA_FINAL }), 401);
    });
    await t('Reativar e rebaixar/promover reflete na hora (perfil lido do banco)', async () => {
      status(await http('PUT', `/usuarios/${E.ids.oper}`, { nome: 'ZZTESTE Operadora', login: loginOper, perfil: 'GERENTE', ativo: true }, A), 200);
      const tk = (await http('POST', '/auth/login', { login: loginOper, senha: SENHA_FINAL })).data.token; status(await http('GET', '/dashboard', undefined, tk), 200);
      status(await http('PUT', `/usuarios/${E.ids.oper}`, { nome: 'ZZTESTE Operadora', login: loginOper, perfil: 'OPERADOR', ativo: true }, A), 200);
      status(await http('GET', '/dashboard', undefined, tk), 403);
    });
    await t('Gerente redefine senha: usuário volta a ter senha provisória e sessões caem', async () => {
      const tk = (await http('POST', '/auth/login', { login: loginOper, senha: SENHA_FINAL })).data.token;
      status(await http('PUT', `/usuarios/${E.ids.oper}`, { nome: 'ZZTESTE Operadora', login: loginOper, perfil: 'OPERADOR', ativo: true, senha: 'OutraProvisoria#3' }, A), 200);
      status(await http('GET', '/auth/me', undefined, tk), 401);
      const l = await http('POST', '/auth/login', { login: loginOper, senha: 'OutraProvisoria#3' }); status(l, 200); igual(l.data.usuario.deve_trocar_senha, true, 'deve_trocar_senha');
    });

  } finally {
    // ───── restaura o que o teste mexeu em configuração (sempre) ─────
    try {
      if (E.taxasOriginais) await http('PUT', '/taxas', { taxas: E.taxasOriginais.map(x => ({ forma_pagamento: x.forma_pagamento, taxa_percentual: x.taxa_percentual })) }, E.tokens.admin);
      if (E.nichoOriginal) await http('PUT', '/configuracoes', { nicho: E.nichoOriginal }, E.tokens.admin);
      if (E.tokens.admin) await http('POST', '/auth/logout', {}, E.tokens.admin);
      console.log('\n(taxas e perfil do negócio restaurados)');
    } catch (e) { console.log('\n⚠ Não consegui restaurar taxas/perfil automaticamente:', e.message); }
  }

  // ───── resumo ─────
  const falhas = resultados.filter(r => !r.ok);
  console.log('\n══════════════════════════════════════');
  console.log(`${resultados.length} testes: ${resultados.length - falhas.length} passaram, ${falhas.length} falharam.`);
  if (falhas.length) { console.log('\nFALHAS:'); for (const f of falhas) console.log(`  [${f.grupo}] ${f.nome}\n      → ${f.erro}`); }
  fs.writeFileSync(path.join(__dirname, 'relatorio_ultimo_teste.json'), JSON.stringify({ quando: inicio, total: resultados.length, falhas: falhas.length, resultados }, null, 2));
  console.log('\nRelatório salvo em tests/relatorio_ultimo_teste.json');
  console.log('Limpeza dos dados de teste:  node tests/limpar_testes.js --confirmar --limpar-log');
  process.exit(falhas.length ? 1 : 0);
}

main().catch(e => { console.error('\nO teste parou por erro inesperado:', e.message); console.log('Se algo foi criado, limpe com: node tests/limpar_testes.js --confirmar'); process.exit(2); });