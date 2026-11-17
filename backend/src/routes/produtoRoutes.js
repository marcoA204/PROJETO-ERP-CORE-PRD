const express = require('express');
const router = express.Router();
const produtoController = require('../controllers/produtoController');

router.get('/', produtoController.listarProdutos);
router.post('/', produtoController.cadastrarProduto);
router.put('/:id', produtoController.atualizarProduto);
router.post('/:id/entrada', produtoController.entradaEstoque);
router.delete('/:id', produtoController.inativarProduto);
router.get('/:id/ficha', produtoController.obterFicha);
router.put('/:id/ficha', produtoController.salvarFicha);

module.exports = router;