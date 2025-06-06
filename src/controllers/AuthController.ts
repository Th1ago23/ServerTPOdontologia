import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();
const saltRounds = 10;
const jwtSecret = process.env.JWT_SECRET || "JWT_SECRET"; // Use uma variável de ambiente segura

interface CustomError extends Error {
  statusCode?: number;
}

interface AuthRequest extends Request {
  userId?: number;
  patientId?: number;
  isAdmin?: boolean;
}

class AuthController {
  async registerUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        res.status(400).json({ error: "Usuário já cadastrado" });
        return;
      }
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const newUser = await prisma.user.create({ data: { email, password: hashedPassword, isAdmin:true } });
      res.status(201).json({ message: "Usuário registrado com sucesso", userId: newUser.id, email: newUser.email });
    } catch (error) {
      console.error("Erro ao registrar usuário:", error);
      res.status(500).json({ error: "Erro ao registrar usuário" });
    }
  }

  async loginUser(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      console.log('Tentativa de login:', { email });
      
      const user = await prisma.user.findUnique({ where: { email } });
      console.log('Usuário encontrado:', user ? 'Sim' : 'Não');
      
      if (!user) {
        console.log('Usuário não encontrado');
        res.status(401).json({ error: "Credenciais inválidas" });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      console.log('Senha corresponde:', passwordMatch ? 'Sim' : 'Não');
      
      if (!passwordMatch) {
        console.log('Senha incorreta');
        res.status(401).json({ error: "Credenciais inválidas" });
        return;
      }

      const token = jwt.sign({ userId: user.id, isAdmin: user.isAdmin }, jwtSecret, { expiresIn: "1h" });
      console.log('Token gerado com sucesso');
      
      res.status(200).json({ 
        token,
        user: {
          id: user.id,
          email: user.email,
          isAdmin: user.isAdmin
        }
      });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  }

  async registerPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, cpf, phone, birthDate, address, city, state, zipCode, country, password, number, complement } = req.body;
  
      // Verificações
      const existingPatientByEmail = await prisma.patient.findUnique({ where: { email } });
      if (existingPatientByEmail) {
        const error = new Error("Paciente com este e-mail já cadastrado") as CustomError;
        error.statusCode = 400;
        return next(error);
      }
  
      const existingPatientByCpf = await prisma.patient.findUnique({ where: { cpf } });
      if (existingPatientByCpf) {
        const error = new Error("Paciente com este CPF já cadastrado") as CustomError;
        error.statusCode = 400;
        return next(error);
      }
  
      const existingPatientByPhone = await prisma.patient.findUnique({ where: { phone } });
      if (existingPatientByPhone) {
        const error = new Error("Paciente com este número de telefone já cadastrado") as CustomError;
        error.statusCode = 400;
        return next(error);
      }
  
      // Criação do paciente
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      const patient = await prisma.patient.create({
        data: {
          name,
          email,
          cpf,
          phone,
          birthDate: new Date(birthDate),
          address,
          number,
          complement,
          city,
          state,
          zipCode,
          country,
          password: hashedPassword,
        },
      });
  
      // Geração do token JWT
      const token = jwt.sign({ id: patient.id, email: patient.email }, process.env.JWT_SECRET as string, {
        expiresIn: "1d",
      });
  
      // Retorna já logado
      res.status(201).json({
        message: "Paciente registrado com sucesso",
        token,
        patientId: patient.id,
      });
    } catch (error) {
      console.error("Erro ao registrar paciente:", error);
      return next(error);
    }
  }

  async loginPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      console.log('Tentativa de login de paciente:', { email });
      
      const patient = await prisma.patient.findUnique({ where: { email } });
      console.log('Paciente encontrado:', patient ? 'Sim' : 'Não');
      
      if (!patient) {
        console.log('Paciente não encontrado');
        const error = new Error("Credenciais inválidas") as CustomError;
        error.statusCode = 401;
        return next(error);
      }

      const passwordMatch = await bcrypt.compare(password, patient.password);
      console.log('Senha corresponde:', passwordMatch ? 'Sim' : 'Não');
      
      if (!passwordMatch) {
        console.log('Senha incorreta');
        const error = new Error("Credenciais inválidas") as CustomError;
        error.statusCode = 401;
        return next(error);
      }

      const token = jwt.sign({ patientId: patient.id }, jwtSecret, { expiresIn: "1h" });
      console.log('Token gerado com sucesso');
      
      res.status(200).json({
        token,
        patientId: patient.id,
        message: "Login realizado com sucesso",
      });
    } catch (error) {
      console.error("Erro ao fazer login do paciente:", error);
      return next(error);
    }
  }

  async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { userId, patientId, isAdmin } = req;
    
    try {
      if (isAdmin && userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, email: true, isAdmin: true },
        });
        if (user) {
          res.status(200).json(user);
          return; // Indica que a função terminou aqui
        } else {
          res.status(404).json({ error: "Usuário não encontrado" });
          return; // Indica que a função terminou aqui
        }
      } else if (!isAdmin && patientId) {
        const patient = await prisma.patient.findUnique({
          where: { id: patientId },
          select: { id: true, name: true, email: true, phone: true, cpf: true, birthDate: true, address: true, number: true, complement: true, city: true, state: true, zipCode: true, country: true, createdAt: true },
        });
        if (patient) {
          res.status(200).json(patient);
          return; // Indica que a função terminou aqui
        } else {
          res.status(404).json({ error: "Paciente não encontrado" });
          return; // Indica que a função terminou aqui
        }
      }
  
      res.status(400).json({ error: "Tipo de usuário inválido no token" });
      return; // Indica que a função terminou aqui
    } catch (error) {
      console.error("Erro ao buscar dados do usuário/paciente:", error);
      return next(error); // Passa o erro para o middleware de tratamento de erros
    }
  }

  async checkUserType(req: Request, res: Response): Promise<void> {
    try {
      const { email } = req.body;
      console.log('Verificando tipo de usuário:', { email });

      // Verifica se é um admin
      const admin = await prisma.user.findUnique({ where: { email } });
      if (admin) {
        console.log('Usuário encontrado como admin');
        res.status(200).json({ type: 'admin' });
        return;
      }

      // Verifica se é um paciente
      const patient = await prisma.patient.findUnique({ where: { email } });
      if (patient) {
        console.log('Usuário encontrado como paciente');
        res.status(200).json({ type: 'patient' });
        return;
      }

      console.log('Usuário não encontrado');
      res.status(404).json({ error: 'Usuário não encontrado' });
    } catch (error) {
      console.error('Erro ao verificar tipo de usuário:', error);
      res.status(500).json({ error: 'Erro ao verificar tipo de usuário' });
    }
  }

  async unifiedLogin(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;
      console.log('Tentativa de login unificado:', { email });

      // Tenta como paciente primeiro
      const patient = await prisma.patient.findUnique({ where: { email } });
      if (patient) {
        console.log('Paciente encontrado, verificando senha...');
        const passwordMatch = await bcrypt.compare(password, patient.password);
        if (passwordMatch) {
          console.log('Senha do paciente correta, gerando token...');
          const token = jwt.sign({ patientId: patient.id }, jwtSecret, { expiresIn: "1h" });
          res.status(200).json({
            token,
            patientId: patient.id,
            type: 'patient',
            message: "Login realizado com sucesso"
          });
          return;
        }
      }

      // Se não for paciente ou senha incorreta, tenta como admin
      const admin = await prisma.user.findUnique({ where: { email } });
      if (admin) {
        console.log('Admin encontrado, verificando senha...');
        const passwordMatch = await bcrypt.compare(password, admin.password);
        if (passwordMatch) {
          console.log('Senha do admin correta, gerando token...');
          const token = jwt.sign({ userId: admin.id, isAdmin: admin.isAdmin }, jwtSecret, { expiresIn: "1h" });
          res.status(200).json({
            token,
            user: {
              id: admin.id,
              email: admin.email,
              isAdmin: admin.isAdmin
            },
            type: 'admin',
            message: "Login realizado com sucesso"
          });
          return;
        }
      }

      // Se chegou aqui, não encontrou usuário ou senha incorreta
      console.log('Credenciais inválidas');
      res.status(401).json({ error: "Credenciais inválidas" });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  }
}
export default new AuthController();