const express = require('express');
const router = express.Router();
const despesaController = require('../controllers/despesaController');

router.post('/', despesaController.registrarDespesa);

module.exports = router;
