const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

router.get('/curva-abc', analyticsController.curvaAbc);
router.get('/estoque-parado', analyticsController.estoqueParado);
router.get('/picos', analyticsController.picos);

module.exports = router;