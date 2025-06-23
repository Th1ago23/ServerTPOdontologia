"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const AuthController_1 = __importDefault(require("../controllers/AuthController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.post('/register', AuthController_1.default.registerPatient.bind(AuthController_1.default));
router.post('/login', AuthController_1.default.loginPatient.bind(AuthController_1.default));
router.post('/verify-email', AuthController_1.default.verifyEmail.bind(AuthController_1.default));
router.post('/resend-verification', AuthController_1.default.resendVerificationEmail.bind(AuthController_1.default));
router.post('/forgot-password', AuthController_1.default.requestPasswordReset.bind(AuthController_1.default));
router.post('/logout', authMiddleware_1.authenticateToken, authMiddleware_1.authenticatePatient, AuthController_1.default.logout.bind(AuthController_1.default));
router.get('/me', authMiddleware_1.authenticateToken, authMiddleware_1.authenticatePatient, AuthController_1.default.me.bind(AuthController_1.default));
router.get('/user-type', AuthController_1.default.getUserType.bind(AuthController_1.default));
exports.default = router;
