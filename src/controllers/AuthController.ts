import { Request, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { generateVerificationCode, sendVerificationEmail, verifyEmail, sendPasswordResetEmail } from "../services/verificationService";
import crypto from "crypto";

const prisma = new PrismaClient();
const saltRounds = 10;
const jwtSecret = process.env.JWT_SECRET || "JWT_SECRET";
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || "REFRESH_TOKEN_SECRET";

interface CustomError extends Error {
  statusCode?: number;
}

interface AuthRequest extends Request {
  userId?: number;
  patientId?: number;
  isAdmin?: boolean;
}

class AuthController {
  private generateTokens(userId: number, isAdmin: boolean) {
    const accessToken = jwt.sign(
      { userId, isAdmin },
      jwtSecret,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { userId, isAdmin },
      refreshTokenSecret,
      { expiresIn: "7d" }
    );

    return { accessToken, refreshToken };
  }

  private async saveRefreshToken(userId: number | null, patientId: number | null, refreshToken: string) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    await prisma.refreshToken.create({
      data: {
        token: hashedToken,
        userId,
        patientId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
      },
    });
  }

  private async revokeRefreshToken(token: string) {
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    await prisma.refreshToken.deleteMany({
      where: { token: hashedToken },
    });
  }

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

      const { accessToken, refreshToken } = this.generateTokens(user.id, true);
      console.log('Token gerado com sucesso');

      // Salvar refresh token
      await this.saveRefreshToken(user.id, null, refreshToken);

      // Configurar cookie com o token
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 15 * 60 * 1000 // 15 minutos
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dias
      });

      res.status(200).json({
        message: "Login realizado com sucesso",
        user: {
          id: user.id,
          email: user.email,
          isAdmin: true
        }
      });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
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
      console.log('Tentativa de login paciente:', { email });
      
      const patient = await prisma.patient.findUnique({ where: { email } });
      console.log('Paciente encontrado:', patient ? 'Sim' : 'Não');
      
      if (!patient) {
        console.log('Paciente não encontrado');
        res.status(401).json({ error: "Credenciais inválidas" });
        return;
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
        res.status(401).json({ error: "Credenciais inválidas" });
        return;
      }

      const { accessToken, refreshToken } = this.generateTokens(patient.id, false);
      await this.saveRefreshToken(null, patient.id, refreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 15 * 60 * 1000, // 15 minutos
        domain: process.env.NODE_ENV === 'production' ? '.tatianepeixotoodonto.live' : undefined
      });

      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
        domain: process.env.NODE_ENV === 'production' ? '.tatianepeixotoodonto.live' : undefined
      });

      res.status(200).json({
        message: "Login realizado com sucesso",
        user: {
          id: patient.id,
          name: patient.name,
          email: patient.email,
          isAdmin: false
        }
      });
    } catch (error) {
      console.error("Erro ao fazer login:", error);
      res.status(500).json({ error: "Erro ao fazer login" });
    }
  }

  async me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: "Não autorizado" });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: req.userId },
        select: {
          id: true,
          email: true,
          isAdmin: true
        }
      });

      if (!user) {
        res.status(404).json({ error: "Usuário não encontrado" });
        return;
      }

      res.status(200).json(user);
    } catch (error) {
      console.error("Erro ao buscar usuário:", error);
      res.status(500).json({ error: "Erro ao buscar usuário" });
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

  async logout(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (refreshToken) {
        await this.revokeRefreshToken(refreshToken);
      }

      res.clearCookie('accessToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        domain: process.env.NODE_ENV === 'production' ? '.tatianepeixotoodonto.live' : undefined
      });

      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        domain: process.env.NODE_ENV === 'production' ? '.tatianepeixotoodonto.live' : undefined
      });

      res.status(200).json({ message: "Logout realizado com sucesso" });
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
      res.status(500).json({ error: "Erro ao fazer logout" });
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

  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const refreshToken = req.cookies.refreshToken;

      if (!refreshToken) {
        res.status(401).json({ error: "Refresh token não fornecido" });
        return;
      }

      const decoded = jwt.verify(refreshToken, refreshTokenSecret) as { userId: number; isAdmin: boolean };
      const hashedToken = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");

      const storedToken = await prisma.refreshToken.findFirst({
        where: {
          token: hashedToken,
          userId: decoded.userId,
          expiresAt: { gt: new Date() },
        },
      });

      if (!storedToken) {
        res.status(401).json({ error: "Refresh token inválido ou expirado" });
        return;
      }

      const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(
        decoded.userId,
        decoded.isAdmin
      );

      await this.revokeRefreshToken(refreshToken);
      await this.saveRefreshToken(decoded.userId, null, newRefreshToken);

      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 15 * 60 * 1000, // 15 minutos
        domain: process.env.NODE_ENV === 'production' ? '.tatianepeixotoodonto.live' : undefined
      });

      res.cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
        domain: process.env.NODE_ENV === 'production' ? '.tatianepeixotoodonto.live' : undefined
      });

      res.status(200).json({ message: "Tokens atualizados com sucesso" });
    } catch (error) {
      console.error("Erro ao atualizar tokens:", error);
      res.status(401).json({ error: "Erro ao atualizar tokens" });
    }
  }
}
export default new AuthController();