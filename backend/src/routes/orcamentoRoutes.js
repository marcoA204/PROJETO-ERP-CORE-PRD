const express = require('express');
const router = express.Router();
const orcamentoController = require('../controllers/orcamentoController');

router.get('/', orcamentoController.listarOrcamentos);
router.post('/', orcamentoController.criarOrcamento);
router.get('/:id', orcamentoController.obterOrcamento);
router.post('/:id/cancelar', orcamentoController.cancelarOrcamento);

module.exports = router;