import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const jwtSecret = process.env.JWT_SECRET || "JWT_SECRET";

interface AuthRequest extends Request {
  userId?: number;
  patientId?: number;
  isAdmin?: boolean;
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Pegar o token do cookie
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ error: "Token não fornecido" });
    }

    const decoded = jwt.verify(token, jwtSecret) as {
      userId?: number;
      patientId?: number;
      isAdmin?: boolean;
    };

    // Adicionar informações do usuário à requisição
    req.userId = decoded.userId;
    req.patientId = decoded.patientId;
    req.isAdmin = decoded.isAdmin;

    next();
  } catch (error) {
    console.error("Erro na autenticação:", error);
    res.status(401).json({ error: "Token inválido" });
  }
};

export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.isAdmin) {
    return res.status(403).json({ error: "Acesso negado" });
  }
  next();
};

export const patientMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.patientId) {
    return res.status(403).json({ error: "Acesso negado" });
  }
  next();
}; 