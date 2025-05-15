import express from 'express';
import patientRoutes from './patientRoutes';
import authRoutes from './authRoutes';
import authPatientRoutes from './authPatientRoutes';
import adminRoutes from './adminRoutes';
import { authenticateToken } from '../middleware/authMiddleware';
import AuthController from '../controllers/AuthController';
import AppointmentRequestController from '../controllers/AppointmentRequestController';
import AppointmentManagementController from '../controllers/AppointmentManagementController';

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/auth-patient', authPatientRoutes);
router.use('/patients', patientRoutes);
router.use('/admin', adminRoutes);

// Info do usuário autenticado
router.get('/me', authenticateToken, AuthController.me);

// Criar uma nova solicitação de consulta
router.post('/appointment-requests', authenticateToken, AppointmentRequestController.create.bind(AppointmentRequestController));

// Listar consultas do paciente
router.get('/appointment-requests', authenticateToken, AppointmentRequestController.listPatientAppointments.bind(AppointmentRequestController));

// Histórico de consultas do paciente
router.get('/appointments/history/:patientId', authenticateToken, AppointmentManagementController.getAppointmentHistory.bind(AppointmentManagementController));

router.get('/test-api', (req, res) => {
    res.status(200).json({ message: 'API está funcionando!' });
  });
  
export default router;