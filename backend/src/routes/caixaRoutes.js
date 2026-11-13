const express = require('express');
const router = express.Router();
const caixaController = require('../controllers/caixaController');

router.post('/abrir', caixaController.abrirCaixa);
router.post('/fechar', caixaController.fecharCaixa);

module.exports = router;