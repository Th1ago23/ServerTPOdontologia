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
    // Permite requisições sem origin (ex: ferramentas internas, mobile, etc)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error('Not allowed by CORS'), false);
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
  credentials: true
};

// Middlewares de segurança
app.use(helmet()); // Adiciona headers de segurança
app.use(limiter); // Rate limiting
app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use(cookieParser());

// Middleware de logging
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('user-agent')
  });
  next();
});

// Middleware para corrigir URLs com duplo slash
app.use((req, res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
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