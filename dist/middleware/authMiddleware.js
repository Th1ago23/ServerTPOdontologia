"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticatePatient = exports.authenticateAdmin = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const authenticateToken = async (req, res, next) => {
    var _a;
    try {
        const authHeader = req.headers["authorization"];
        const token = authHeader && authHeader.split(" ")[1] || ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.accessToken);
        if (!token) {
            console.log('Token não encontrado');
            res.status(401).json({ error: "Não autorizado" });
            return;
        }
        console.log('Token encontrado, verificando...');
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        console.log('Token decodificado:', decoded);
        if (decoded.userId) {
            req.userId = decoded.userId;
            req.isAdmin = decoded.isAdmin;
            req.userType = 'admin';
            console.log('Usuário autenticado como admin:', req.userId);
        }
        else if (decoded.patientId) {
            req.patientId = decoded.patientId;
            req.isAdmin = false;
            req.userType = 'patient';
            console.log('Usuário autenticado como paciente:', req.patientId);
        }
        else {
            console.log('Token não contém userId ou patientId');
            res.status(401).json({ error: "Token inválido" });
            return;
        }
        next();
    }
    catch (err) {
        console.error('Erro na autenticação:', err);
        res.status(401).json({ error: "Token inválido" });
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
const authenticatePatient = async (req, res, next) => {
    if (req.userType === 'patient' && req.patientId) {
        return next();
    }
    else {
        res.status(403).json({ error: "Acesso proibido - Apenas pacientes" });
    }
};
exports.authenticatePatient = authenticatePatient;
