import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import routes from './routes';
import dotenv from 'dotenv';
import cors, { CorsOptions } from 'cors';
import { PrismaClient } from '@prisma/client';
import authRoutes from './routes/authRoutes';
import patientRoutes from './routes/patientRoutes';
import appointmentRoutes from './routes/appointmentRoutes';
import contactRoutes from './routes/contactRoutes';
import authPatientRoutes from './routes/authPatientRoutes';
import { authMiddleware } from './middleware/auth';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import winston from 'winston';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

// Configuração do logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Configuração do rate limiter
const defaultLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP
  message: 'Muitas requisições deste IP, tente novamente mais tarde'
});

const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 5, // limite de 5 tentativas de login por hora
  message: 'Muitas tentativas de login, tente novamente mais tarde'
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200, // limite de 200 requisições por IP
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

// Configuração do CORS
const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Log para debug
    console.log('=== CORS Debug ===');
    console.log('Origin recebida:', origin);
    console.log('Origins permitidas:', allowedOrigins);
    console.log('NODE_ENV:', process.env.NODE_ENV);
    console.log('FRONTEND_URL:', process.env.FRONTEND_URL);
    
    // Permite requisições sem origin (ex: ferramentas internas, mobile, etc)
    if (!origin) {
      console.log('Requisição sem origin - permitindo');
      return callback(null, true);
    }
    
    // Verifica se a origin está na lista de permitidas
    if (allowedOrigins.includes(origin)) {
      console.log('Origin permitida:', origin);
      callback(null, true);
    } else {
      console.log('Origin bloqueada:', origin);
      // Em produção, retorna erro mais específico
      if (process.env.NODE_ENV === 'production') {
        callback(new Error(`Origin ${origin} não permitida por CORS`), false);
      } else {
        console.log('Ambiente de desenvolvimento - permitindo origin');
        callback(null, true); // Em desenvolvimento, permite todas as origins
      }
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'Cookie', 'Set-Cookie'],
  exposedHeaders: ['Set-Cookie'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // Cache das respostas preflight por 24 horas
};

// Middleware para forçar HTTPS
app.use((req: Request, res: Response, next: NextFunction) => {
  if (process.env.NODE_ENV === 'production' && !req.secure) {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// Middleware para corrigir URLs com duplo slash - DEVE vir antes do CORS
app.use((req, res, next) => {
  // Remove múltiplos slashes consecutivos
  req.url = req.url.replace(/\/+/g, '/');
  
  // Log para debug
  console.log('=== URL Debug ===');
  console.log('URL original:', req.originalUrl);
  console.log('URL corrigida:', req.url);
  console.log('Headers:', req.headers);
  console.log('Cookies:', req.cookies);
  
  next();
});

// Middlewares de segurança
app.use(helmet({
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

// Adicionar headers de segurança adicionais
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('X-Download-Options', 'noopen');
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  next();
});

// Aplicar rate limiters específicos
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);
app.use('/', defaultLimiter);

app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(cookieParser());

// Middleware de logging
app.use((req: Request, res: Response, next: NextFunction) => {
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

// Middleware para debug de CORS
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log('=== CORS Debug Detalhado ===');
  console.log('Origin:', req.get('origin'));
  console.log('Referer:', req.get('referer'));
  console.log('Method:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', req.headers);
  console.log('Cookies:', req.cookies);
  next();
});

// Rota raiz
app.get('/', (req, res) => {
  logger.info('Acesso à rota raiz', {
    ip: req.ip,
    origin: req.get('origin'),
    headers: req.headers
  });
  res.json({ message: 'API TPOdontologia está funcionando!' });
});

// Rotas da API
app.use('/api', routes);
app.use('/api/auth', authRoutes);
app.use('/api/patients', authMiddleware, patientRoutes);
app.use('/api/appointments', authMiddleware, appointmentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/auth-patient', authPatientRoutes);

// Middleware de erro
interface AppError extends Error {
  statusCode?: number;
}

app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
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

export { app, prisma, logger };