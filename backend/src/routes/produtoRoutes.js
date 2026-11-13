const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');

// Quando o frontend acessar GET /api/produtos, o Controller entra em ação
router.get('/', produtoController.listarProdutos);

// POTS: Envia dados (Cadastrar)
router.post('/', produtoController.cadastrarProduto);

module.exports = router;