import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Carrega as variáveis de ambiente
dotenv.config();

// Configura o banco de dados de teste
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tpodontologia_test';

// Exporta a instância do Prisma para uso nos testes
export const prisma = new PrismaClient(); 