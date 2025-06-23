import express from 'express';
import AuthController from '../controllers/AuthController';
import { authenticateToken, authenticatePatient } from '../middleware/authMiddleware';

const router = express.Router();

// Rotas de autenticação de pacientes
router.post('/register', AuthController.registerPatient.bind(AuthController));
router.post('/login', AuthController.loginPatient.bind(AuthController));
router.post('/verify-email', AuthController.verifyEmail.bind(AuthController));
router.post('/resend-verification', AuthController.resendVerificationEmail.bind(AuthController));
router.post('/forgot-password', AuthController.requestPasswordReset.bind(AuthController));
router.post('/logout', authenticateToken, authenticatePatient, AuthController.logout.bind(AuthController));
router.get('/me', authenticateToken, authenticatePatient, AuthController.me.bind(AuthController));
router.get('/user-type', AuthController.getUserType.bind(AuthController));

export default router;
