import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Defina a interface AuthRequest uma única vez
export interface AuthRequest extends Request {
  userId?: number;
  patientId?: number;
  isAdmin?: boolean;
  userType?: 'admin' | 'patient';
}

export const authenticateToken: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1] || req.cookies?.accessToken;

    console.log('Debug Auth - authHeader:', authHeader);
    console.log('Debug Auth - cookies:', req.cookies);
    console.log('Debug Auth - token encontrado:', !!token);

    if (!token) {
      console.log('Token não encontrado');
      res.status(401).json({ error: "Não autorizado" });
      return;
    }

    console.log('Token encontrado, verificando...');
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    console.log('Token decodificado:', decoded);

    if (decoded.userId) {
      req.userId = decoded.userId;
      req.isAdmin = decoded.isAdmin;
      req.userType = 'admin';
      console.log('Usuário autenticado como admin:', req.userId);
    } else if (decoded.patientId) {
      req.patientId = decoded.patientId;
      req.isAdmin = false;
      req.userType = 'patient';
      console.log('Usuário autenticado como paciente:', req.patientId);
    } else {
      console.log('Token não contém userId ou patientId');
      res.status(401).json({ error: "Token inválido" });
      return;
    }

    next();
  } catch (err) {
    console.error('Erro na autenticação:', err);
    res.status(401).json({ error: "Token inválido" });
  }
};

export const authenticateAdmin: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  console.log('Debug Admin - req.isAdmin:', req.isAdmin);
  console.log('Debug Admin - req.userType:', req.userType);
  console.log('Debug Admin - req.userId:', req.userId);
  
  if (req.isAdmin) {
    console.log('Debug Admin - Acesso permitido');
    return next();
  } else {
    console.log('Debug Admin - Acesso negado');
    res.status(403).json({ error: "Acesso proibido" });
  }
};

export const authenticatePatient: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.userType === 'patient' && req.patientId) {
    return next();
  } else {
    res.status(403).json({ error: "Acesso proibido - Apenas pacientes" });
  }
};
