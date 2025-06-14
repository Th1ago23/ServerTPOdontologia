import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { logger } from "../app";

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error("JWT_SECRET não está definido nas variáveis de ambiente");
}

interface AuthRequest extends Request {
  userId?: number;
  patientId?: number;
  isAdmin?: boolean;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Verificar se o token está presente no cookie
    const accessToken = req.cookies.accessToken;
    if (!accessToken) {
      logger.warn("Tentativa de acesso sem token", {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      return res.status(401).json({ error: "Token não fornecido" });
    }

    // Verificar formato do token
    if (!/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/.test(accessToken)) {
      logger.warn("Token com formato inválido", {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      return res.status(401).json({ error: "Token inválido" });
    }

    // Verificar e decodificar o token
    const decoded = jwt.verify(accessToken, jwtSecret) as {
      userId?: number;
      patientId?: number;
      isAdmin?: boolean;
      exp?: number;
      iat?: number;
    };

    // Verificar se o token expirou
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      logger.warn("Token expirado", {
        ip: req.ip,
        path: req.path,
        method: req.method
      });
      return res.status(401).json({ 
        error: "Token expirado",
        code: "TOKEN_EXPIRED"
      });
    }

    // Adicionar informações do usuário à requisição
    req.userId = decoded.userId;
    req.patientId = decoded.patientId;
    req.isAdmin = decoded.isAdmin;

    // Log de acesso bem-sucedido
    logger.info("Acesso autenticado", {
      userId: req.userId,
      patientId: req.patientId,
      isAdmin: req.isAdmin,
      ip: req.ip,
      path: req.path,
      method: req.method
    });

    next();
  } catch (error) {
    logger.error("Erro na autenticação", {
      error: error instanceof Error ? error.message : "Erro desconhecido",
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ 
        error: "Token expirado",
        code: "TOKEN_EXPIRED"
      });
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({ error: "Token inválido" });
    }
    
    res.status(500).json({ error: "Erro interno na autenticação" });
  }
};

export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.isAdmin) {
    logger.warn("Tentativa de acesso administrativo não autorizado", {
      userId: req.userId,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return res.status(403).json({ error: "Acesso negado - Privilégios administrativos necessários" });
  }
  next();
};

export const patientMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.patientId) {
    logger.warn("Tentativa de acesso de paciente não autorizado", {
      userId: req.userId,
      ip: req.ip,
      path: req.path,
      method: req.method
    });
    return res.status(403).json({ error: "Acesso negado - Autenticação de paciente necessária" });
  }
  next();
}; 