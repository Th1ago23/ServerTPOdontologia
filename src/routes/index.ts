import express from 'express';
import patientRoutes from './patientRoutes';
import authRoutes from './authRoutes';
import authPatientRoutes from './authPatientRoutes';
import adminRoutes from './adminRoutes';
import contactRoutes from './contactRoutes';
import { authenticateToken, authenticatePatient, authenticateAdmin } from '../middleware/authMiddleware';
import AuthController from '../controllers/AuthController';
import AppointmentRequestController from '../controllers/AppointmentRequestController';
import AppointmentManagementController from '../controllers/AppointmentManagementController';

const router = express.Router();

// Rotas de autenticação
router.use('/auth', authRoutes);
router.use('/auth-patient', authPatientRoutes);

// Rotas de pacientes
router.use('/patients', patientRoutes);

// Rotas de administração
router.use('/admin', adminRoutes);

// Rotas de contato
router.use('/contact', contactRoutes);

// Info do usuário autenticado
router.get('/me', authenticateToken, AuthController.me.bind(AuthController));

// Rotas de agendamento (requer autenticação de paciente)
router.post('/appointment-requests', authenticateToken, authenticatePatient, AppointmentRequestController.create.bind(AppointmentRequestController));
router.get('/appointment-requests', authenticateToken, authenticatePatient, AppointmentRequestController.listPatientAppointments.bind(AppointmentRequestController));

// Rotas de histórico de consultas
router.get('/appointments/history/:patientId', authenticateToken, authenticatePatient, AppointmentManagementController.getAppointmentHistory.bind(AppointmentManagementController));
router.get('/appointments/history', authenticateToken, authenticatePatient, AppointmentManagementController.getMyAppointmentHistory.bind(AppointmentManagementController));

export default router;