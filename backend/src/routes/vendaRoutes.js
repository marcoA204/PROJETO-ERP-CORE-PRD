const express = require('express');
const router = express.Router();
const vendaController = require('../controllers/vendaController');

router.post('/', vendaController.registrarVenda);
router.get('/:id/recibo', vendaController.obterRecibo);

module.exports = router;
