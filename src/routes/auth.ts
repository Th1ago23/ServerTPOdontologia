import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authMiddleware, adminMiddleware } from '../middleware/auth';

const router = Router();
const authController = new AuthController();

// Rotas públicas
router.post('/login', authController.loginUser);
router.post('/register', authController.registerUser);
router.post('/verify-email', authController.verifyEmail);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Rotas protegidas
router.get('/me', authMiddleware, authController.getCurrentUser);
router.post('/logout', authMiddleware, authController.logout);

// Rotas de admin
router.get('/admin/users', adminMiddleware, authController.getAllUsers);
router.put('/admin/users/:id', adminMiddleware, authController.updateUser);
router.delete('/admin/users/:id', adminMiddleware, authController.deleteUser);

export default router; 