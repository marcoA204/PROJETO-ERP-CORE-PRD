const express = require('express');
const router = express.Router();
const taxaController = require('../controllers/taxaController');

router.get('/', taxaController.listarTaxas);
router.put('/', taxaController.salvarTaxas);

module.exports = router;