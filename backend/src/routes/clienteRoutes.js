const express = require('express');
const router = express.Router();
const clienteController = require('../controllers/clienteController');

router.get('/', clienteController.listarClientes);
router.post('/', clienteController.salvarCliente);
router.put('/:id', clienteController.salvarCliente);
router.delete('/:id', clienteController.inativarCliente);
router.get('/:id/historico', clienteController.historicoCliente);

module.exports = router;