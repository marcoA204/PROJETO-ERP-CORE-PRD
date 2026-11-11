const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { connectToDatabase } = require('./config/db');

const app = express();

app.use(cors());
app.use(express.json());

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