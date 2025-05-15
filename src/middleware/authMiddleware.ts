import { Request, Response, NextFunction, RequestHandler } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  userId?: number;
  isAdmin?: boolean;
}

export const authenticateToken: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (token == null) {
    res.status(401).json({ error: "Não autorizado" });
    return;
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET as string
    ) as JwtPayload;

    if (decoded.userId) {
      (req as AuthRequest).userId = decoded.userId;
      (req as AuthRequest).isAdmin = decoded.isAdmin;
      (req as AuthRequest).userType = 'admin';
    } else if (decoded.patientId) {
      (req as AuthRequest).patientId = decoded.patientId; // Mantém patientId separado
      (req as AuthRequest).isAdmin = false;
      (req as AuthRequest).userType = 'patient';
    }

    next();
  } catch (err) {
    res.status(403).json({ error: "Token inválido" });
  }
};

// Defina a interface AuthRequest para incluir patientId e userType
export interface AuthRequest extends Request {
  userId?: number;
  patientId?: number;
  isAdmin?: boolean;
  userType?: 'admin' | 'patient';
}

export const authenticateAdmin: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.isAdmin) {
    return next();
  } else {
    res.status(403).json({ error: "Acesso proibido" });
  }
};
