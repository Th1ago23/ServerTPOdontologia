import { Router } from 'express';
import { PatientController } from '../controllers/PatientController';
import { authMiddleware } from '../middleware/auth';

const router = Router();
const patientController = new PatientController();

// Rotas públicas
router.post('/register', patientController.register);
router.post('/login', patientController.login);
router.post('/verify-email', patientController.verifyEmail);

// Rotas protegidas
router.get('/profile', authMiddleware, patientController.getProfile);
router.put('/profile', authMiddleware, patientController.updateProfile);
router.get('/appointments', authMiddleware, patientController.getAppointments);
router.post('/appointments', authMiddleware, patientController.createAppointment);
router.put('/appointments/:id', authMiddleware, patientController.updateAppointment);
router.delete('/appointments/:id', authMiddleware, patientController.cancelAppointment);

export default router; 