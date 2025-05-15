"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const routes_1 = __importDefault(require("./routes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes")); // Importando o arquivo index.ts de rotas
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors")); // Importe o middleware CORS
dotenv_1.default.config();
const app = (0, express_1.default)();
// Configuração do CORS
const corsOptions = {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173', // URL do seu frontend
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use((0, cors_1.default)(corsOptions));
app.use(body_parser_1.default.json());
app.use('/api', routes_1.default);
app.use('/api/admin', adminRoutes_1.default);
app.use((err, req, res, next) => {
    console.error(err.stack);
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Erro interno do servidor';
    res.status(statusCode).json({ error: message });
});
exports.default = app;
