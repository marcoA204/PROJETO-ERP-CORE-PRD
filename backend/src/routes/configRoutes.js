const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');

router.get('/', configController.obterConfiguracoes);
router.put('/', configController.salvarConfiguracoes);

module.exports = router;