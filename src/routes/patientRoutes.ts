import express from 'express';
import PatientController from '../controllers/PatientController';
import { authenticateToken, authenticateAdmin } from '../middleware/authMiddleware';

const router = express.Router();

// Rota para cadastro de pacientes (acesso público)
router.post('/', PatientController.create);

// Rotas que exigem autenticação e privilégios de administrador
router.get('/', authenticateToken, authenticateAdmin, PatientController.listAll);
router.put('/:id', authenticateToken, authenticateAdmin, PatientController.update);
router.delete('/:id', authenticateToken, authenticateAdmin, PatientController.delete);

// Rotas para o paciente acessar seu próprio perfil
router.get('/me', authenticateToken, PatientController.getMyProfile);
router.get('/:id', authenticateToken, PatientController.getById);

export default router;