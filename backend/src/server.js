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

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/produtos', produtoRoutes);
app.use('/api/caixa', caixaRoutes);
app.use('/api/vendas', vendaRoutes);
app.use('/api/despesas', despesaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clientes', clienteRoutes);
app.use('/api/orcamentos', orcamentoRoutes);
app.use('/api/configuracoes', configRoutes);

// Rota base de teste
app.get('/', (req, res) => {
    res.json({
        status: "Online",
        mensagem: "API do LogiFlow está rodando 100% no Node.js!",
        ambiente: "Desenvolvimento"
    });
});

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => {
    console.log(`🚀 Servidor LogiFlow rodando na URL http://localhost:${PORTA}`);
});

// Testa a conexão ao iniciar (se falhar, o erro já foi mostrado e a próxima requisição tenta de novo)
connectToDatabase().catch(() => {});