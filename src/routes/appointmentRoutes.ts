import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
// Importe o controller de Appointment se existir
// import AppointmentController from '../controllers/AppointmentController';

const router = Router();

// Exemplo de rota protegida para listar agendamentos
router.get('/', authMiddleware, (req, res) => {
  // Aqui você pode chamar o controller real
  res.json({ message: 'Listagem de agendamentos (appointmentRoutes)' });
});

// Outras rotas podem ser adicionadas aqui

export default router; 