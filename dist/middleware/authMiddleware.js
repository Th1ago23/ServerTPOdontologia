"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateAdmin = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];
    if (token == null) {
        res.status(401).json({ error: "Não autorizado" });
        return;
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        if (decoded.userId) {
            req.userId = decoded.userId;
            req.isAdmin = decoded.isAdmin;
            req.userType = 'admin';
        }
        else if (decoded.patientId) {
            req.patientId = decoded.patientId; // Mantém patientId separado
            req.isAdmin = false;
            req.userType = 'patient';
        }
        next();
    }
    catch (err) {
        res.status(403).json({ error: "Token inválido" });
    }
};
exports.authenticateToken = authenticateToken;
const authenticateAdmin = async (req, res, next) => {
    if (req.isAdmin) {
        return next();
    }
    else {
        res.status(403).json({ error: "Acesso proibido" });
    }
};
exports.authenticateAdmin = authenticateAdmin;
