import express from 'express';
import PatientController from '../controllers/PatientController';
import { authenticateToken, authenticateAdmin } from '../middleware/authMiddleware';

const router = express.Router();

// Rota para cadastro de pacientes (acesso público, por enquanto)
router.post('/', PatientController.create);

// Rotas que exigem autenticação e privilégios de administrador
router.get('/', authenticateToken, authenticateAdmin, PatientController.listAll); // Exemplo: Listar todos
router.get('/:id', authenticateToken, authenticateAdmin, PatientController.getById); // Exemplo: Buscar por ID
router.put('/:id', authenticateToken, authenticateAdmin, PatientController.update); // Exemplo: Atualizar
router.delete('/:id', authenticateToken, authenticateAdmin, PatientController.delete); // Exemplo: Deletar

export default router;