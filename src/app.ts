import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import routes from './routes';
import dotenv from 'dotenv';
import cors, { CorsOptions } from 'cors';

dotenv.config();

const app = express();

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

// Middleware para corrigir URLs com duplo slash
app.use((req, res, next) => {
  req.url = req.url.replace(/\/+/g, '/');
  next();
});

app.use(cors(corsOptions));
app.use(bodyParser.json());

// Rota raiz
app.get('/', (req, res) => {
  res.json({ message: 'API TPOdontologia está funcionando!' });
});

// Rotas da API
app.use('/api', routes);

// Middleware de erro
interface AppError extends Error {
  statusCode?: number;
}

app.use((err: AppError, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno do servidor';
  res.status(statusCode).json({ error: message });
});

export default app;