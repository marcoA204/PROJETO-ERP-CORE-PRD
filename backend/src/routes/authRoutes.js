const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { autenticar } = require('../middleware/auth');

// Pública: é por aqui que se entra
router.post('/login', authController.login);

// Precisam de sessão válida (mas funcionam mesmo com senha provisória)
router.get('/me', autenticar, authController.me);
router.post('/logout', autenticar, authController.logout);
router.post('/trocar-senha', autenticar, authController.trocarSenha);

module.exports = router;