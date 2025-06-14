import express from 'express';
import AuthController from "../controllers/AuthController";
import AppointmentRequestController from "../controllers/AppointmentRequestController";
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();
const authController = new AuthController();

router.post('/register', authController.registerPatient.bind(authController));
router.post('/login', authController.loginPatient.bind(authController));
router.post('/verify-email', authController.verifyEmail.bind(authController));
router.post('/resend-verification', authController.resendVerificationCode.bind(authController));

// Protegendo as rotas com authenticateToken
router.get('/me', authenticateToken, authController.me.bind(authController)); // Informações do usuário autenticado

router.post('/appointment-requests', authenticateToken, AppointmentRequestController.create); // Criar nova consulta
router.get('/appointment-requests', authenticateToken, AppointmentRequestController.listPatientAppointments); // Listar consultas do paciente

router.get('/test-email', authController.sendTestEmail.bind(authController));

export default router;
