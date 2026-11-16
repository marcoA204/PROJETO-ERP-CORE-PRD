const express = require('express');
const router = express.Router();
const vendaController = require('../controllers/vendaController');

router.get('/', vendaController.listarVendas);
router.post('/', vendaController.registrarVenda);
router.get('/:id/recibo', vendaController.obterRecibo);
router.post('/:id/cancelar', vendaController.cancelarVenda);

module.exports = router;
