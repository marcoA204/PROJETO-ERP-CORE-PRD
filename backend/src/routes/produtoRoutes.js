const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');

router.get('/', produtoController.listarProdutos);
router.post('/', produtoController.cadastrarProduto);
router.put('/:id', produtoController.atualizarProduto);
router.post('/:id/entrada', produtoController.entradaEstoque);
router.delete('/:id', produtoController.inativarProduto);

module.exports = router;
