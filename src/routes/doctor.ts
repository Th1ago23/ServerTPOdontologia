import { Router } from 'express';
import { DoctorController } from '../controllers/DoctorController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();
const doctorController = new DoctorController();

// Rotas públicas
router.get('/', doctorController.getAllDoctors);
router.get('/:id', doctorController.getDoctorById);
router.get('/:id/availability', doctorController.getDoctorAvailability);

// Rotas protegidas (admin)
router.post('/', adminMiddleware, doctorController.createDoctor);
router.put('/:id', adminMiddleware, doctorController.updateDoctor);
router.delete('/:id', adminMiddleware, doctorController.deleteDoctor);
router.get('/admin/stats', adminMiddleware, doctorController.getDoctorStats);

export default router; 