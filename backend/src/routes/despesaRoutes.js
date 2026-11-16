const express = require('express');
const router = express.Router();
const despesaController = require('../controllers/despesaController');

router.get('/', despesaController.listarDespesas);
router.post('/', despesaController.registrarDespesa);
router.post('/:id/pagar', despesaController.pagarDespesa);

module.exports = router;
