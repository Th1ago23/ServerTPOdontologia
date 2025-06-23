"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authPatientMiddleware = authPatientMiddleware;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function authPatientMiddleware(req, res, next) {
    var _a;
    const token = (_a = req.headers.authorization) === null || _a === void 0 ? void 0 : _a.split(" ")[1];
    if (!token)
        return res.status(401).json({ error: "Token não fornecido" });
    const jwtSecret = process.env.JWT_SECRET || "default_secret";
    try {
        const decoded = jsonwebtoken_1.default.verify(token, jwtSecret);
        req.patientId = decoded.patientId;
        next();
    }
    catch (err) {
        return res.status(401).json({ error: "Token inválido" });
    }
}
