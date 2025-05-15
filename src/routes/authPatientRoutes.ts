import express from 'express';
import AuthController from "../controllers/AuthController";
import AppointmentRequestController from "../controllers/AppointmentRequestController";
import { authenticateToken } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', AuthController.registerPatient);
router.post('/login', AuthController.loginPatient);

// Protegendo as rotas com authenticateToken
router.get('/me', authenticateToken, AuthController.me); // Informações do usuário autenticado

router.post('/appointment-requests', authenticateToken, AppointmentRequestController.create); // Criar nova consulta
router.get('/appointment-requests', authenticateToken, AppointmentRequestController.listPatientAppointments); // Listar consultas do paciente

export default router;
