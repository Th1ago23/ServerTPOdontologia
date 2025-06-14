import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateVerificationCode, sendVerificationEmail, verifyEmail, sendPasswordResetEmail } from "../services/verificationService";

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
      const code = generateVerificationCode();
      await prisma.user.update({
        where: { email },
        data: {
          emailVerificationCode: code,
          emailVerificationExpires: new Date(Date.now() + 3600000)
        }
      });
      await sendVerificationEmail(email, code);

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
      
      const code = generateVerificationCode();
      if (isAdmin) {
        await prisma.user.update({
          where: { email },
          data: {
            emailVerificationCode: code,
            emailVerificationExpires: new Date(Date.now() + 3600000)
          }
        });
      } else {
        await prisma.patient.update({
          where: { email },
          data: {
            emailVerificationCode: code,
            emailVerificationExpires: new Date(Date.now() + 3600000)
          }
        });
      }
      await sendVerificationEmail(email, code);
      
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
      
      const user = await prisma.user.findUnique({ where: { email } });
      
      if (!user) {
        res.status(401).json({ message: "Credenciais inválidas" });
        return;
      }

      if (!user.isEmailVerified) {
        res.status(401).json({ 
          message: "E-mail não verificado",
          needsVerification: true
        });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, user.password);
      
      if (!passwordMatch) {
        res.status(401).json({ message: "Credenciais inválidas" });
        return;
      }

      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          isAdmin: user.isAdmin 
        }, 
        jwtSecret, 
        { expiresIn: "24h" }
      );
      
      // Configurar o cookie HTTP-only
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
      });
      
      res.status(200).json({ 
        message: "Login realizado com sucesso",
        user: { 
          id: user.id, 
          email: user.email, 
          isAdmin: user.isAdmin 
        } 
      });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
    }
  }

  async registerPatient(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('Iniciando registro de paciente. Dados recebidos:', JSON.stringify(req.body, null, 2));
      const { name, email, cpf, phone, birthDate, address, city, state, zipCode, country, password, number, complement } = req.body;

      // Validação dos campos obrigatórios
      const requiredFields = ['name', 'email', 'cpf', 'phone', 'birthDate', 'address', 'city', 'state', 'zipCode', 'country', 'password', 'number'];
      const missingFields = requiredFields.filter(field => !req.body[field]);
      
      if (missingFields.length > 0) {
        console.log('Campos obrigatórios faltando:', missingFields);
        const error = new Error(`Campos obrigatórios faltando: ${missingFields.join(', ')}`) as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      // Validação de formato de email
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        console.log('Email inválido:', email);
        const error = new Error("Formato de email inválido") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      // Validação de CPF (apenas números)
      const cpfRegex = /^\d{11}$/;
      if (!cpfRegex.test(cpf.replace(/\D/g, ""))) {
        console.log('CPF inválido:', cpf);
        const error = new Error("CPF deve conter 11 dígitos numéricos") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      // Validação de telefone (apenas números)
      const phoneRegex = /^\d{10,11}$/;
      if (!phoneRegex.test(phone.replace(/\D/g, ""))) {
        console.log('Telefone inválido:', phone);
        const error = new Error("Telefone deve conter 10 ou 11 dígitos numéricos") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      // Validação de data de nascimento
      const birthDateObj = new Date(birthDate);
      if (isNaN(birthDateObj.getTime())) {
        console.log('Data de nascimento inválida:', birthDate);
        const error = new Error("Data de nascimento inválida") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      // Verificar se o email já está em uso
      const existingPatient = await prisma.patient.findUnique({ where: { email } });
      if (existingPatient) {
        console.log('Email já cadastrado:', email);
        const error = new Error("Email já cadastrado") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      // Verificar se o CPF já está em uso
      const existingCpf = await prisma.patient.findUnique({ where: { cpf } });
      if (existingCpf) {
        console.log('CPF já cadastrado:', cpf);
        const error = new Error("CPF já cadastrado") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      // Verificar se o telefone já está em uso
      const existingPhone = await prisma.patient.findUnique({ where: { phone } });
      if (existingPhone) {
        console.log('Telefone já cadastrado:', phone);
        const error = new Error("Telefone já cadastrado") as CustomError;
        error.statusCode = 400;
        return next(error);
      }

      // Hash da senha
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Criar o paciente
      const newPatient = await prisma.patient.create({
        data: {
          name,
          email,
          password: hashedPassword,
          cpf: cpf.replace(/\D/g, ""),
          phone: phone.replace(/\D/g, ""),
          birthDate: birthDateObj,
          address,
          number,
          complement: complement || "",
          city,
          state,
          zipCode,
          country,
          isEmailVerified: false
        }
      });

      // Gerar e enviar código de verificação
      const code = generateVerificationCode();
      await prisma.patient.update({
        where: { email },
        data: {
          emailVerificationCode: code,
          emailVerificationExpires: new Date(Date.now() + 3600000)
        }
      });
      await sendVerificationEmail(email, code);

      res.status(201).json({
        message: "Paciente registrado com sucesso. Por favor, verifique seu e-mail.",
        patientId: newPatient.id,
        email: newPatient.email
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
      
      const patient = await prisma.patient.findUnique({ where: { email } });
      
      if (!patient) {
        res.status(401).json({ message: "Credenciais inválidas" });
        return;
      }

      if (!patient.isEmailVerified) {
        res.status(401).json({ 
          message: "E-mail não verificado",
          needsVerification: true
        });
        return;
      }

      const passwordMatch = await bcrypt.compare(password, patient.password);
      
      if (!passwordMatch) {
        res.status(401).json({ message: "Credenciais inválidas" });
        return;
      }

      const token = jwt.sign(
        { 
          patientId: patient.id,
          email: patient.email
        }, 
        jwtSecret, 
        { expiresIn: "24h" }
      );
      
      // Configurar o cookie HTTP-only
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 24 * 60 * 60 * 1000 // 24 horas
      });
      
      res.status(200).json({ 
        message: "Login realizado com sucesso",
        patient: { 
          id: patient.id, 
          email: patient.email,
          name: patient.name
        } 
      });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      res.status(500).json({ message: "Erro interno do servidor" });
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
      // Limpar o cookie
      res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      res.status(200).json({ message: 'Logout realizado com sucesso' });
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      res.status(500).json({ message: 'Erro interno do servidor' });
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

      // Primeiro atualiza os campos de verificação de email
      await prisma.patient.update({
        where: { email },
        data: {
          emailVerificationCode: code,
          emailVerificationExpires: expiresAt
        },
      });

      // Depois atualiza os campos de reset de senha usando uma query raw
      await prisma.$executeRaw`
        UPDATE "Patient"
        SET "passwordResetCode" = ${code},
            "passwordResetExpires" = ${expiresAt}
        WHERE email = ${email}
      `;

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

      // Primeiro atualiza os campos de verificação de email
      await prisma.patient.update({
        where: { email },
        data: {
          emailVerificationCode: code,
          emailVerificationExpires: expiresAt
        },
      });

      // Depois atualiza os campos de reset de senha usando uma query raw
      await prisma.$executeRaw`
        UPDATE "Patient"
        SET "passwordResetCode" = ${code},
            "passwordResetExpires" = ${expiresAt}
        WHERE email = ${email}
      `;

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