import express, { Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import routes from './routes';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();

// Configuração do CORS
const corsOptions = {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
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