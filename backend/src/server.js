const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectToDatabase } = require('./config/db');

// Importa a nossa nova rota de produtos
const produtoRoutes = require('./routes/produtoRoutes');
const caixaRoutes = require('./routes/caixaRoutes');
const vendaRoutes = require('./routes/vendaRoutes');

const app = express();

app.use(cors());
app.use(express.json());

// Diz ao servidor para usar o arquivo de rotas quando acessarem /api/produtos
app.use('/api/produtos', produtoRoutes);
app.use('/api/caixa', caixaRoutes);
app.use('/api/vendas', vendaRoutes);

// Rota base de teste (a que você já viu funcionando)
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

connectToDatabase();