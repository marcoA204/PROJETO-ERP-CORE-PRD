const express = require('express');
const router = express.Router();
const auditoriaController = require('../controllers/auditoriaController');

router.get('/estoque', auditoriaController.movimentosEstoque);
router.get('/erros', auditoriaController.errosDoSistema);

module.exports = router;