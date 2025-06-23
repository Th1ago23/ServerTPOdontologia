"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.patientMiddleware = exports.adminMiddleware = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const app_1 = require("../app");
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
    throw new Error("JWT_SECRET não está definido nas variáveis de ambiente");
}
const authMiddleware = (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken;
        if (!accessToken) {
            app_1.logger.warn("Tentativa de acesso sem token", {
                ip: req.ip,
                path: req.path,
                method: req.method
            });
            return res.status(401).json({ error: "Token não fornecido" });
        }
        if (!/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(accessToken)) {
            app_1.logger.warn("Token com formato inválido", {
                ip: req.ip,
                path: req.path,
                method: req.method
            });
            return res.status(401).json({ error: "Token inválido" });
        }
        const decoded = jsonwebtoken_1.default.verify(accessToken, jwtSecret);
        if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
            app_1.logger.warn("Token expirado", {
                ip: req.ip,
                path: req.path,
                method: req.method
            });
            return res.status(401).json({
                error: "Token expirado",
                code: "TOKEN_EXPIRED"
            });
        }
        req.userId = decoded.userId;
        req.patientId = decoded.patientId;
        req.isAdmin = decoded.isAdmin;
        app_1.logger.info("Acesso autenticado", {
            userId: req.userId,
            patientId: req.patientId,
            isAdmin: req.isAdmin,
            ip: req.ip,
            path: req.path,
            method: req.method
        });
        next();
    }
    catch (error) {
        app_1.logger.error("Erro na autenticação", {
            error: error instanceof Error ? error.message : "Erro desconhecido",
            ip: req.ip,
            path: req.path,
            method: req.method
        });
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return res.status(401).json({
                error: "Token expirado",
                code: "TOKEN_EXPIRED"
            });
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return res.status(401).json({ error: "Token inválido" });
        }
        res.status(500).json({ error: "Erro interno na autenticação" });
    }
};
exports.authMiddleware = authMiddleware;
const adminMiddleware = (req, res, next) => {
    if (!req.isAdmin) {
        app_1.logger.warn("Tentativa de acesso administrativo não autorizado", {
            userId: req.userId,
            ip: req.ip,
            path: req.path,
            method: req.method
        });
        return res.status(403).json({ error: "Acesso negado - Privilégios administrativos necessários" });
    }
    next();
};
exports.adminMiddleware = adminMiddleware;
const patientMiddleware = (req, res, next) => {
    if (!req.patientId) {
        app_1.logger.warn("Tentativa de acesso de paciente não autorizado", {
            userId: req.userId,
            ip: req.ip,
            path: req.path,
            method: req.method
        });
        return res.status(403).json({ error: "Acesso negado - Autenticação de paciente necessária" });
    }
    next();
};
exports.patientMiddleware = patientMiddleware;
