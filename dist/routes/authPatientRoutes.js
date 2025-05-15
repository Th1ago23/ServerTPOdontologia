"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const AuthController_1 = __importDefault(require("../controllers/AuthController"));
const AppointmentRequestController_1 = __importDefault(require("../controllers/AppointmentRequestController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.post('/register', AuthController_1.default.registerPatient);
router.post('/login', AuthController_1.default.loginPatient);
// Protegendo as rotas com authenticateToken
router.get('/me', authMiddleware_1.authenticateToken, AuthController_1.default.me); // Informações do usuário autenticado
router.post('/appointment-requests', authMiddleware_1.authenticateToken, AppointmentRequestController_1.default.create); // Criar nova consulta
router.get('/appointment-requests', authMiddleware_1.authenticateToken, AppointmentRequestController_1.default.listPatientAppointments); // Listar consultas do paciente
exports.default = router;
