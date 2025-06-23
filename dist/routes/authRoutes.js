"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AuthController_1 = __importDefault(require("../controllers/AuthController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
router.post('/register', AuthController_1.default.registerUser.bind(AuthController_1.default));
router.post('/login', AuthController_1.default.loginUser.bind(AuthController_1.default));
router.post('/verify-email', AuthController_1.default.verifyEmail.bind(AuthController_1.default));
router.post('/resend-verification', AuthController_1.default.resendVerificationCode.bind(AuthController_1.default));
router.post("/logout", AuthController_1.default.logout.bind(AuthController_1.default));
router.post("/refresh-token", AuthController_1.default.refreshToken.bind(AuthController_1.default));
router.get("/me", authMiddleware_1.authenticateToken, AuthController_1.default.me.bind(AuthController_1.default));
exports.default = router;
