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
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite de 100 requisições por IP
  message: 'Muitas requisições deste IP, tente novamente mais tarde'
});

const allowedOrigins = [
  'https://www.tatianepeixotoodonto.live',
  'http://www.tatianepeixotoodonto.live',
  'https://tatianepeixotoodonto.live',
  'http://tatianepeixotoodonto.live',
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
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // Cache das respostas preflight por 24 horas
};

// Middleware para corrigir URLs com duplo slash - DEVE vir antes do CORS
app.use((req, res, next) => {
  // Remove múltiplos slashes consecutivos
  req.url = req.url.replace(/\/+/g, '/');
  
  // Log para debug
  console.log('=== URL Debug ===');
  console.log('URL original:', req.originalUrl);
  console.log('URL corrigida:', req.url);
  console.log('Headers:', req.headers);
  
  next();
});

// Middlewares de segurança
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "unsafe-none" }
}));
app.use(limiter);
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(cookieParser());

// Middleware de logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    origin: req.get('origin'),
    headers: req.headers
  });
  next();
});

// Rota raiz
app.get('/', (req, res) => {
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