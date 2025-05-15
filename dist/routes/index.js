"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const patientRoutes_1 = __importDefault(require("./patientRoutes"));
const authRoutes_1 = __importDefault(require("./authRoutes"));
const authPatientRoutes_1 = __importDefault(require("./authPatientRoutes"));
const adminRoutes_1 = __importDefault(require("./adminRoutes"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const AuthController_1 = __importDefault(require("../controllers/AuthController"));
const AppointmentRequestController_1 = __importDefault(require("../controllers/AppointmentRequestController"));
const router = express_1.default.Router();
router.use('/auth', authRoutes_1.default);
router.use('/auth-patient', authPatientRoutes_1.default);
router.use('/patients', patientRoutes_1.default);
router.use('/admin', adminRoutes_1.default);
// Info do usuário autenticado
router.get('/me', authMiddleware_1.authenticateToken, AuthController_1.default.me);
// Criar uma nova solicitação de consulta
router.post('/appointment-requests', authMiddleware_1.authenticateToken, AppointmentRequestController_1.default.create.bind(AppointmentRequestController_1.default));
// Listar consultas do paciente
router.get('/appointment-requests', authMiddleware_1.authenticateToken, AppointmentRequestController_1.default.listPatientAppointments.bind(AppointmentRequestController_1.default));
router.get('/test-api', (req, res) => {
    res.status(200).json({ message: 'API está funcionando!' });
});
exports.default = router;
