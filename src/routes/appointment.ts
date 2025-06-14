import { Router } from 'express';
import { AppointmentController } from '../controllers/AppointmentController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();
const appointmentController = new AppointmentController();

// Rotas protegidas
router.get('/', authMiddleware, appointmentController.getAllAppointments);
router.get('/:id', authMiddleware, appointmentController.getAppointmentById);
router.post('/', authMiddleware, appointmentController.createAppointment);
router.put('/:id', authMiddleware, appointmentController.updateAppointment);
router.delete('/:id', authMiddleware, appointmentController.cancelAppointment);

// Rotas de admin
router.get('/admin/all', adminMiddleware, appointmentController.getAllAppointmentsAdmin);
router.put('/admin/:id/status', adminMiddleware, appointmentController.updateAppointmentStatus);
router.get('/admin/stats', adminMiddleware, appointmentController.getAppointmentStats);

export default router; 