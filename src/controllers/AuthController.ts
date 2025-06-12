import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateVerificationCode, sendVerificationEmail, verifyEmail } from "../services/verificationService";

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
      const newUser = await prisma.user.create({ 
        data: { 
          email, 
          password: hashedPassword, 
          isAdmin: true,
          isEmailVerified: false
        } 
      });

      // Enviar código de verificação
      await generateVerificationCode(email, true);

      res.status(201).json({ 
        message: "Usuário registrado com sucesso. Por favor, verifique seu e-mail.", 
        userId: newUser.id, 
        email: newUser.email 
      });
    } catch (error) {
      console.error("Erro ao registrar usuário:", error);
      res.status(500).json({ error: "Erro ao registrar usuário" });
    }
  }

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, code } = req.body;

      if (!email || !code) {
        const error = new Error("E-mail e código são obrigatórios") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      const result = await verifyEmail(email, code);

      if (!result.success) {
        const error = new Error(result.message) as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      res.status(200).json({ message: result.message });
    } catch (error) {
      console.error("Erro ao verificar e-mail:", error);
      if (error instanceof Error) {
        const customError = error as CustomError;
        res.status(customError.statusCode || 500).json({ 
          error: customError.message || "Erro ao verificar e-mail" 
        });
      } else {
        res.status(500).json({ error: "Erro ao verificar e-mail" });
      }
    }
  }

  async resendVerificationCode(req: Request, res: Response): Promise<void> {
    try {
      const { email, isAdmin } = req.body;
      
      await generateVerificationCode(email, isAdmin);
      
      res.status(200).json({ 
        message: "Novo código de verificação enviado com sucesso" 
      });
    } catch (error) {
      console.error("Erro ao reenviar código:", error);
      res.status(500).json({ 
        error: "Erro ao reenviar código de verificação" 
      });
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

      if (!user.isEmailVerified) {
        console.log('E-mail não verificado');
        res.status(401).json({ 
          error: "E-mail não verificado",
          needsVerification: true
        });
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
      
      // Configurar o cookie HTTP-only
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        domain: process.env.NODE_ENV === 'production' ? '.tatianepeixotoodonto.live' : undefined
      });
      
      res.status(200).json({ token, user: { id: user.id, email: user.email, isAdmin: user.isAdmin } });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  }

  async registerPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, email, cpf, phone, birthDate, address, city, state, zipCode, country, password, number, complement } = req.body;

      // Validação dos campos obrigatórios
      const requiredFields = ['name', 'email', 'cpf', 'phone', 'birthDate', 'address', 'city', 'state', 'zipCode', 'country', 'password', 'number'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      
      if (missingFields.length > 0) {
        const error = new Error(`Campos obrigatórios faltando: ${missingFields.join(', ')}`) as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      // Validação de formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        const error = new Error("Formato de email inválido") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      // Validação de CPF (apenas formato básico)
      const cpfRegex = /^\d{11}$/;
      if (!cpfRegex.test(cpf.replace(/\D/g, ""))) {
        const error = new Error("CPF inválido") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      // Validação de telefone
      const phoneRegex = /^\d{10,11}$/;
      if (!phoneRegex.test(phone.replace(/\D/g, ""))) {
        const error = new Error("Telefone inválido") as CustomError;
        error.statusCode = 400;
        return next(error);
      }
  
      // Verificações de duplicidade
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

      // Gerar código de verificação
      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      // Criação do paciente
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      
      // Primeiro criar o paciente
      const patient = await prisma.patient.create({
        data: {
          name,
          email,
          cpf,
          phone,
          birthDate: new Date(birthDate),
          address,
          number,
          complement: complement || "",
          city,
          state,
          zipCode,
          country: country || "Brasil",
          password: hashedPassword,
          isEmailVerified: false,
          emailVerificationCode: code,
          emailVerificationExpires: expiresAt
        },
      });

      // Depois atualizar com o código de verificação
      await prisma.patient.update({
        where: { id: patient.id },
        data: {
          emailVerificationCode: code,
          emailVerificationExpires: expiresAt
        }
      });

      try {
        // Enviar email de verificação
        await sendVerificationEmail(email, code);
      } catch (emailError) {
        console.error("Erro ao enviar email de verificação:", emailError);
        // Não interrompe o fluxo se o email falhar
      }
  
      res.status(201).json({
        message: "Paciente registrado com sucesso. Por favor, verifique seu e-mail.",
        patientId: patient.id,
      });
    } catch (error) {
      console.error("Erro ao registrar paciente:", error);
      if (error instanceof Error) {
        const customError = error as CustomError;
        res.status(customError.statusCode || 500).json({ 
          error: customError.message || "Erro ao registrar paciente" 
        });
      } else {
        res.status(500).json({ error: "Erro ao registrar paciente" });
      }
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

      if (!patient.isEmailVerified) {
        console.log('E-mail não verificado');
        res.status(401).json({ 
          error: "E-mail não verificado",
          needsVerification: true
        });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, patient.password);
      console.log('Senha corresponde:', passwordMatch ? 'Sim' : 'Não');
      
      if (!passwordMatch) {
        console.log('Senha incorreta');
        const error = new Error("Credenciais inválidas") as CustomError;
        error.statusCode = 401;
        return next(error);
      }

      const token = jwt.sign({ patientId: patient.id, isAdmin: false }, jwtSecret, { expiresIn: "1h" });
      console.log('Token gerado com sucesso');
      
      // Configurar o cookie HTTP-only
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        domain: process.env.NODE_ENV === 'production' ? '.tatianepeixotoodonto.live' : undefined
      });
      
      res.status(200).json({ token, patientId: patient.id, message: "Login realizado com sucesso" });
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

  async logout(req: Request, res: Response) {
    try {
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });
      res.json({ message: 'Logout realizado com sucesso' });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      res.status(500).json({ error: 'Erro ao fazer logout' });
    }
  }

  async sendTestEmail(req: Request, res: Response): Promise<void> {
    try {
      const { sendEmail } = await import('../services/emailService');
      await sendEmail({
        to: 'thiago.peixots@gmail.com',
        subject: 'Teste de envio de e-mail - TP Odontologia',
        text: 'Este é um e-mail de teste enviado pelo endpoint /test-email.',
        html: '<h2>Teste de envio de e-mail</h2><p>Este é um e-mail de teste enviado pelo endpoint <b>/test-email</b>.</p>'
      });
      res.status(200).json({ message: 'E-mail de teste enviado com sucesso!' });
    } catch (error) {
      console.error('Erro ao enviar e-mail de teste:', error);
      res.status(500).json({ error: 'Erro ao enviar e-mail de teste', details: error instanceof Error ? error.message : error });
    }
  }

  async requestPasswordReset(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        const error = new Error("E-mail é obrigatório") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      const patient = await prisma.patient.findUnique({ where: { email } });
      if (!patient) {
        const error = new Error("Paciente não encontrado") as CustomError;
        error.statusCode = 404;
        return next(error);
      }

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      await prisma.patient.update({
        where: { email },
        data: {
          passwordResetCode: code,
          passwordResetExpires: expiresAt,
        },
      });

      try {
        await sendPasswordResetEmail(email, code);
      } catch (emailError) {
        console.error("Erro ao enviar e-mail de redefinição:", emailError);
        const error = new Error("Erro ao enviar e-mail de redefinição") as CustomError;
        error.statusCode = 500;
        return next(error);
      }

      res.status(200).json({ message: "E-mail de redefinição de senha enviado" });
    } catch (error) {
      console.error("Erro ao solicitar redefinição de senha:", error);
      if (error instanceof Error) {
        const customError = error as CustomError;
        res.status(customError.statusCode || 500).json({ 
          error: customError.message || "Erro ao solicitar redefinição de senha" 
        });
      } else {
        res.status(500).json({ error: "Erro ao solicitar redefinição de senha" });
      }
    }
  }

  async resendVerificationEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email } = req.body;

      if (!email) {
        const error = new Error("E-mail é obrigatório") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      const patient = await prisma.patient.findUnique({ where: { email } });
      if (!patient) {
        const error = new Error("Paciente não encontrado") as CustomError;
        error.statusCode = 404;
        return next(error);
      }

      if (patient.isEmailVerified) {
        const error = new Error("E-mail já verificado") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      const code = generateVerificationCode();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hora

      await prisma.patient.update({
        where: { email },
        data: {
          emailVerificationCode: code,
          emailVerificationExpires: expiresAt,
        },
      });

      try {
        await sendVerificationEmail(email, code);
      } catch (emailError) {
        console.error("Erro ao enviar e-mail de verificação:", emailError);
        const error = new Error("Erro ao enviar e-mail de verificação") as CustomError;
        error.statusCode = 500;
        return next(error);
      }

      res.status(200).json({ message: "E-mail de verificação reenviado" });
    } catch (error) {
      console.error("Erro ao reenviar e-mail de verificação:", error);
      if (error instanceof Error) {
        const customError = error as CustomError;
        res.status(customError.statusCode || 500).json({ 
          error: customError.message || "Erro ao reenviar e-mail de verificação" 
        });
      } else {
        res.status(500).json({ error: "Erro ao reenviar e-mail de verificação" });
      }
    }
  }
}
export default new AuthController();