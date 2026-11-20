const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectToDatabase } = require('./config/db');

const produtoRoutes = require('./routes/produtoRoutes');
const caixaRoutes = require('./routes/caixaRoutes');
const vendaRoutes = require('./routes/vendaRoutes');
const despesaRoutes = require('./routes/despesaRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
const orcamentoRoutes = require('./routes/orcamentoRoutes');
const configRoutes = require('./routes/configRoutes');
const taxaRoutes = require('./routes/taxaRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const authRoutes = require('./routes/authRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const auditoriaRoutes = require('./routes/auditoriaRoutes');
const { autenticar, autorizar } = require('./middleware/auth');
const { garantirAdminInicial } = require('./utils/adminInicial');

const app = express();

app.use(cors());
app.use(express.json());

// Login é público. TUDO que vem depois exige sessão válida + permissão do perfil
// (a matriz de permissões está em middleware/permissoes.js).
app.use('/api/auth', authRoutes);
app.use('/api', autenticar, autorizar);

app.use('/api/produtos', produtoRoutes);
app.use('/api/caixa', caixaRoutes);
app.use('/api/vendas', vendaRoutes);
app.use('/api/despesas', despesaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/orcamentos', orcamentoRoutes);
app.use('/api/configuracoes', configRoutes);
app.use('/api/taxas', taxaRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/auditoria', auditoriaRoutes);

// Rota base de teste
app.get('/', (req, res) => {
    res.json({
        status: "Online",
        mensagem: "API do Logi Flow está rodando 100% no Node.js!",
        ambiente: "Desenvolvimento"
    });
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log(`🚀 Servidor Logi Flow rodando na URL http://localhost:${PORTA}`);
});

// Testa a conexão ao iniciar (se falhar, o erro já foi mostrado e a próxima requisição tenta de novo)
connectToDatabase().then(garantirAdminInicial).catch(() => {});