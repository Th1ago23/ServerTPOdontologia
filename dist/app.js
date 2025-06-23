"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.prisma = exports.app = void 0;
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const routes_1 = __importDefault(require("./routes"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const client_1 = require("@prisma/client");
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const patientRoutes_1 = __importDefault(require("./routes/patientRoutes"));
const appointmentRoutes_1 = __importDefault(require("./routes/appointmentRoutes"));
const contactRoutes_1 = __importDefault(require("./routes/contactRoutes"));
const authPatientRoutes_1 = __importDefault(require("./routes/authPatientRoutes"));
const auth_1 = require("./middleware/auth");
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const winston_1 = __importDefault(require("winston"));
dotenv_1.default.config();
const app = (0, express_1.default)();
exports.app = app;
const prisma = new client_1.PrismaClient();
exports.prisma = prisma;
const logger = winston_1.default.createLogger({
    level: 'info',
    format: winston_1.default.format.combine(winston_1.default.format.timestamp(), winston_1.default.format.json()),
    transports: [
        new winston_1.default.transports.File({ filename: 'error.log', level: 'error' }),
        new winston_1.default.transports.File({ filename: 'combined.log' })
    ]
});
exports.logger = logger;
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston_1.default.transports.Console({
        format: winston_1.default.format.simple()
    }));
}
const defaultLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: 'Muitas requisições deste IP, tente novamente mais tarde'
});
const authLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: 'Muitas tentativas de login, tente novamente mais tarde'
});
const apiLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'Muitas requisições à API, tente novamente mais tarde'
});
const allowedOrigins = [
    'https://www.tatianepeixotoodonto.live',
    'http://www.tatianepeixotoodonto.live',
    'https://tatianepeixotoodonto.live',
    'http://tatianepeixotoodonto.live',
    'https://api.tatianepeixotoodonto.live',
    'http://api.tatianepeixotoodonto.live',
    'https://tpodontologia-frontend-699fc3612709.herokuapp.com',
    'http://tpodontologia-frontend-699fc3612709.herokuapp.com',
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'exp://localhost:19000',
    'exp://192.168.1.1:19000',
    'exp://192.168.1.2:19000',
    'exp://192.168.1.3:19000',
    'exp://192.168.1.4:19000',
    'exp://192.168.1.5:19000',
    'exp://192.168.1.6:19000',
    'exp://192.168.1.7:19000',
    'exp://192.168.1.8:19000',
    'exp://192.168.1.9:19000',
    'exp://192.168.1.10:19000',
    'http://localhost:19006',
    'http://localhost:19000'
];
const corsOptions = {
    origin: (origin, callback) => {
        console.log('=== CORS Debug ===');
        console.log('Origin recebida:', origin);
        console.log('Origins permitidas:', allowedOrigins);
        console.log('NODE_ENV:', process.env.NODE_ENV);
        console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
        if (!origin) {
            console.log('Requisição sem origin - permitindo');
            return callback(null, true);
        }
        if (allowedOrigins.includes(origin)) {
            console.log('Origin permitida:', origin);
            callback(null, true);
        }
        else {
            console.log('Origin bloqueada:', origin);
            callback(new Error(`Origin ${origin} não permitida por CORS`), false);
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'Cookie', 'Set-Cookie'],
    exposedHeaders: ['Set-Cookie'],
    credentials: true,
    preflightContinue: false,
    optionsSuccessStatus: 204,
    maxAge: 86400
};
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'production' && !req.secure && req.headers['x-forwarded-proto'] !== 'https' && req.method !== 'OPTIONS') {
        return res.redirect(`https://${req.headers.host}${req.url}`);
    }
    next();
});
app.use((req, res, next) => {
    req.url = req.url.replace(/\/+/g, '/');
    console.log('=== URL Debug ===');
    console.log('URL original:', req.originalUrl);
    console.log('URL corrigida:', req.url);
    console.log('Headers:', req.headers);
    console.log('Cookies:', req.cookies);
    next();
});
app.use((0, helmet_1.default)({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", ...allowedOrigins],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        },
    },
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginEmbedderPolicy: { policy: "require-corp" },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    strictTransportSecurity: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    xFrameOptions: { action: "deny" },
    xXssProtection: true,
    noSniff: true,
    hidePoweredBy: true,
    dnsPrefetchControl: { allow: false }
}));
app.use((req, res, next) => {
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('X-Download-Options', 'noopen');
    res.setHeader('X-DNS-Prefetch-Control', 'off');
    next();
});
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);
app.use('/', defaultLimiter);
app.use((0, cors_1.default)(corsOptions));
app.use(body_parser_1.default.json());
app.use((0, cookie_parser_1.default)(process.env.COOKIE_SECRET));
app.use((req, res, next) => {
    logger.info('=== Nova Requisição ===', {
        method: req.method,
        url: req.url,
        originalUrl: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        origin: req.get('origin'),
        referer: req.get('referer'),
        headers: req.headers,
        body: req.body,
        cookies: req.cookies
    });
    next();
});
app.use((req, res, next) => {
    console.log('=== CORS Debug Detalhado ===');
    console.log('Origin:', req.get('origin'));
    console.log('Referer:', req.get('referer'));
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Headers:', req.headers);
    console.log('Cookies:', req.cookies);
    next();
});
app.get('/', (req, res) => {
    logger.info('Acesso à rota raiz', {
        ip: req.ip,
        origin: req.get('origin'),
        headers: req.headers
    });
    res.json({ message: 'API TPOdontologia está funcionando!' });
});
app.use('/api', routes_1.default);
app.use('/api/auth', authRoutes_1.default);
app.use('/api/patients', auth_1.authMiddleware, patientRoutes_1.default);
app.use('/api/appointments', auth_1.authMiddleware, appointmentRoutes_1.default);
app.use('/api/contact', contactRoutes_1.default);
app.use('/api/auth-patient', authPatientRoutes_1.default);
app.use((err, req, res, next) => {
    logger.error('Erro na aplicação:', {
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    });
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'production'
        ? 'Erro interno do servidor'
        : err.message;
    res.status(statusCode).json({ error: message });
});
