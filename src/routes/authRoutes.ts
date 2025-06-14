import { Router } from 'express';
import AuthController from '../controllers/AuthController';

const router = Router();

router.post('/register', AuthController.registerUser);
router.post('/login', AuthController.loginUser);
router.post('/verify-email', AuthController.verifyEmail);
router.post('/resend-verification', AuthController.resendVerificationCode);
router.post("/logout", AuthController.logout);
router.post("/refresh-token", AuthController.refreshToken);

export default router;