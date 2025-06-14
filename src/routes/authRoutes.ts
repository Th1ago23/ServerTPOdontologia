import { Router } from 'express';
import authController from '../controllers/AuthController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/register', authController.registerUser.bind(authController));
router.post('/login', authController.loginUser.bind(authController));
router.post('/verify-email', authController.verifyEmail.bind(authController));
router.post('/resend-verification', authController.resendVerificationCode.bind(authController));
router.post("/logout", authController.logout.bind(authController));
router.post("/refresh-token", authController.refreshToken.bind(authController));
router.get("/me", authenticateToken, authController.me.bind(authController));

export default router;