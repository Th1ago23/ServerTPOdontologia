import { Router } from 'express';
import AuthController from '../controllers/AuthController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
const authController = new AuthController();

router.post('/register', authController.registerUser.bind(authController));
router.post('/login', authController.loginUser.bind(authController));
router.post('/verify-email', authController.verifyEmail.bind(authController));
router.post('/resend-verification', authController.resendVerificationCode.bind(authController));
router.post("/logout", authController.logout.bind(authController));
router.post("/refresh-token", authController.refreshToken.bind(authController));
router.get("/me", authenticateToken, authController.me.bind(authController));

router.post('/register', AuthController.registerUser);
router.post('/login', AuthController.loginUser);
router.post('/verify-email', AuthController.verifyEmail);
router.post('/resend-verification', AuthController.resendVerificationCode);
router.post("/logout", AuthController.logout);
router.post("/refresh-token", AuthController.refreshToken);
router.get("/me", authenticateToken, AuthController.me);

export default router;