"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const PatientController_1 = __importDefault(require("../controllers/PatientController"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
router.post('/', PatientController_1.default.create);
router.get('/', authMiddleware_1.authenticateToken, authMiddleware_1.authenticateAdmin, PatientController_1.default.listAll);
router.put('/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authenticateAdmin, PatientController_1.default.update);
router.delete('/:id', authMiddleware_1.authenticateToken, authMiddleware_1.authenticateAdmin, PatientController_1.default.delete);
router.get('/me', authMiddleware_1.authenticateToken, PatientController_1.default.getMyProfile);
router.get('/:id', authMiddleware_1.authenticateToken, PatientController_1.default.getById);
router.put('/me', authMiddleware_1.authenticateToken, PatientController_1.default.updateMyProfile);
exports.default = router;
