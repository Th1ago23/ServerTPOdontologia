"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const PatientController_1 = __importDefault(require("../controllers/PatientController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Rota para cadastro de pacientes (acesso público, por enquanto)
router.post('/', PatientController_1.default.create);
// Rotas que exigem autenticação e privilégios de administrador
router.get('/', authMiddleware_1.authenticateToken, authMiddleware_1.authenticateAdmin, PatientController_1.default.listAll); // Exemplo: Listar todos
router.get('/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authenticateAdmin, PatientController_1.default.getById); // Exemplo: Buscar por ID
router.put('/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authenticateAdmin, PatientController_1.default.update); // Exemplo: Atualizar
router.delete('/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authenticateAdmin, PatientController_1.default.delete); // Exemplo: Deletar
exports.default = router;
