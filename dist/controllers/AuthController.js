"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const verificationService_1 = require("../services/verificationService");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
const saltRounds = 10;
const jwtSecret = process.env.JWT_SECRET || "JWT_SECRET";
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET || "REFRESH_TOKEN_SECRET";
class AuthController {
    generateTokens(userId, isAdmin, patientId) {
        const accessToken = jsonwebtoken_1.default.sign({ userId, isAdmin, patientId }, jwtSecret, { expiresIn: "15m" });
        const refreshToken = jsonwebtoken_1.default.sign({ userId, isAdmin, patientId }, refreshTokenSecret, { expiresIn: "7d" });
        return { accessToken, refreshToken };
    }
    async saveRefreshToken(userId, patientId, refreshToken) {
        const hashedToken = crypto_1.default
            .createHash("sha256")
            .update(refreshToken)
            .digest("hex");
        await prisma.refreshToken.create({
            data: {
                token: hashedToken,
                userId,
                patientId,
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
        });
    }
    async revokeRefreshToken(token) {
        const hashedToken = crypto_1.default
            .createHash("sha256")
            .update(token)
            .digest("hex");
        await prisma.refreshToken.deleteMany({
            where: { token: hashedToken },
        });
    }
    setAuthCookies(res, accessToken, refreshToken) {
        const cookieOptions = {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'none',
            maxAge: 15 * 60 * 1000,
            domain: process.env.NODE_ENV === 'production' ? '.tatianepeixotoodonto.live' : undefined
        };
        const refreshCookieOptions = Object.assign(Object.assign({}, cookieOptions), { maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.cookie('accessToken', accessToken, cookieOptions);
        res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    }
    async registerUser(req, res) {
        try {
            const { email, password } = req.body;
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                res.status(400).json({ error: "Usuário já cadastrado" });
                return;
            }
            const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
            const newUser = await prisma.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    isAdmin: true,
                    isEmailVerified: false
                }
            });
            const code = (0, verificationService_1.generateVerificationCode)();
            await prisma.user.update({
                where: { email },
                data: {
                    emailVerificationCode: code,
                    emailVerificationExpires: new Date(Date.now() + 3600000)
                }
            });
            await (0, verificationService_1.sendVerificationEmail)(email, code);
            res.status(201).json({
                message: "Usuário registrado com sucesso. Por favor, verifique seu e-mail.",
                userId: newUser.id,
                email: newUser.email
            });
        }
        catch (error) {
            console.error("Erro ao registrar usuário:", error);
            res.status(500).json({ error: "Erro ao registrar usuário" });
        }
    }
    async verifyEmail(req, res, next) {
        try {
            const { email, code } = req.body;
            if (!email || !code) {
                const error = new Error("E-mail e código são obrigatórios");
                error.statusCode = 400;
                return next(error);
            }
            const result = await (0, verificationService_1.verifyEmail)(email, code);
            if (!result.success) {
                const error = new Error(result.message);
                error.statusCode = 400;
                return next(error);
            }
            res.status(200).json({ message: result.message });
        }
        catch (error) {
            console.error("Erro ao verificar e-mail:", error);
            if (error instanceof Error) {
                const customError = error;
                res.status(customError.statusCode || 500).json({
                    error: customError.message || "Erro ao verificar e-mail"
                });
            }
            else {
                res.status(500).json({ error: "Erro ao verificar e-mail" });
            }
        }
    }
    async resendVerificationCode(req, res) {
        try {
            const { email, isAdmin } = req.body;
            const code = (0, verificationService_1.generateVerificationCode)();
            if (isAdmin) {
                await prisma.user.update({
                    where: { email },
                    data: {
                        emailVerificationCode: code,
                        emailVerificationExpires: new Date(Date.now() + 3600000)
                    }
                });
            }
            else {
                await prisma.patient.update({
                    where: { email },
                    data: {
                        emailVerificationCode: code,
                        emailVerificationExpires: new Date(Date.now() + 3600000)
                    }
                });
            }
            await (0, verificationService_1.sendVerificationEmail)(email, code);
            res.status(200).json({
                message: "Novo código de verificação enviado com sucesso"
            });
        }
        catch (error) {
            console.error("Erro ao reenviar código:", error);
            res.status(500).json({
                error: "Erro ao reenviar código de verificação"
            });
        }
    }
    async loginUser(req, res) {
        try {
            const { email, password } = req.body;
            console.log('Tentativa de login admin:', { email });
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
            const passwordMatch = await bcryptjs_1.default.compare(password, user.password);
            console.log('Senha corresponde:', passwordMatch ? 'Sim' : 'Não');
            if (!passwordMatch) {
                console.log('Senha incorreta');
                res.status(401).json({ error: "Credenciais inválidas" });
                return;
            }
            const { accessToken, refreshToken } = this.generateTokens(user.id, true);
            console.log('Token gerado com sucesso');
            await this.saveRefreshToken(user.id, null, refreshToken);
            this.setAuthCookies(res, accessToken, refreshToken);
            res.status(200).json({
                message: "Login realizado com sucesso",
                accessToken,
                user: {
                    id: user.id,
                    email: user.email,
                    isAdmin: true
                }
            });
        }
        catch (error) {
            console.error("Erro ao fazer login:", error);
            res.status(500).json({ error: "Erro ao fazer login" });
        }
    }
    async registerPatient(req, res, next) {
        try {
            console.log('Iniciando registro de paciente. Dados recebidos:', JSON.stringify(req.body, null, 2));
            const { name, email, cpf, phone, birthDate, address, city, state, zipCode, country, password, number, complement } = req.body;
            const requiredFields = ['name', 'email', 'cpf', 'phone', 'birthDate', 'address', 'city', 'state', 'zipCode', 'country', 'password', 'number'];
            const missingFields = requiredFields.filter(field => !req.body[field]);
            if (missingFields.length > 0) {
                console.log('Campos obrigatórios faltando:', missingFields);
                const error = new Error(`Campos obrigatórios faltando: ${missingFields.join(', ')}`);
                error.statusCode = 400;
                return next(error);
            }
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                console.log('Email inválido:', email);
                const error = new Error("Formato de email inválido");
                error.statusCode = 400;
                return next(error);
            }
            const cpfRegex = /^\d{11}$/;
            if (!cpfRegex.test(cpf.replace(/\D/g, ""))) {
                console.log('CPF inválido:', cpf);
                const error = new Error("CPF deve conter 11 dígitos numéricos");
                error.statusCode = 400;
                return next(error);
            }
            const phoneRegex = /^\d{10,11}$/;
            if (!phoneRegex.test(phone.replace(/\D/g, ""))) {
                console.log('Telefone inválido:', phone);
                const error = new Error("Telefone deve conter 10 ou 11 dígitos numéricos");
                error.statusCode = 400;
                return next(error);
            }
            const birthDateObj = new Date(birthDate);
            if (isNaN(birthDateObj.getTime())) {
                console.log('Data de nascimento inválida:', birthDate);
                const error = new Error("Data de nascimento inválida");
                error.statusCode = 400;
                return next(error);
            }
            const existingPatient = await prisma.patient.findUnique({ where: { email } });
            if (existingPatient) {
                console.log('Email já cadastrado:', email);
                const error = new Error("Email já cadastrado");
                error.statusCode = 400;
                return next(error);
            }
            const existingCpf = await prisma.patient.findUnique({ where: { cpf } });
            if (existingCpf) {
                console.log('CPF já cadastrado:', cpf);
                const error = new Error("CPF já cadastrado");
                error.statusCode = 400;
                return next(error);
            }
            const existingPhone = await prisma.patient.findUnique({ where: { phone } });
            if (existingPhone) {
                console.log('Telefone já cadastrado:', phone);
                const error = new Error("Telefone já cadastrado");
                error.statusCode = 400;
                return next(error);
            }
            const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
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
            const code = (0, verificationService_1.generateVerificationCode)();
            await prisma.patient.update({
                where: { email },
                data: {
                    emailVerificationCode: code,
                    emailVerificationExpires: new Date(Date.now() + 3600000)
                }
            });
            await (0, verificationService_1.sendVerificationEmail)(email, code);
            res.status(201).json({
                message: "Paciente registrado com sucesso. Por favor, verifique seu e-mail.",
                patientId: newPatient.id,
                email: newPatient.email
            });
        }
        catch (error) {
            console.error("Erro ao registrar paciente:", error);
            if (error instanceof Error) {
                const customError = error;
                res.status(customError.statusCode || 500).json({
                    error: customError.message || "Erro ao registrar paciente"
                });
            }
            else {
                res.status(500).json({ error: "Erro ao registrar paciente" });
            }
        }
    }
    async loginPatient(req, res) {
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
            const passwordMatch = await bcryptjs_1.default.compare(password, patient.password);
            console.log('Senha corresponde:', passwordMatch ? 'Sim' : 'Não');
            if (!passwordMatch) {
                console.log('Senha incorreta');
                res.status(401).json({ error: "Credenciais inválidas" });
                return;
            }
            const { accessToken, refreshToken } = this.generateTokens(0, false, patient.id);
            console.log('Token gerado com sucesso');
            await this.saveRefreshToken(null, patient.id, refreshToken);
            this.setAuthCookies(res, accessToken, refreshToken);
            res.status(200).json({
                message: "Login realizado com sucesso",
                accessToken,
                user: {
                    id: patient.id,
                    email: patient.email,
                    name: patient.name,
                    isAdmin: false
                }
            });
        }
        catch (error) {
            console.error("Erro ao fazer login:", error);
            res.status(500).json({ error: "Erro ao fazer login" });
        }
    }
    async me(req, res, next) {
        try {
            console.log('Debug me - userId:', req.userId, 'patientId:', req.patientId, 'isAdmin:', req.isAdmin);
            if (req.patientId) {
                const patient = await prisma.patient.findUnique({
                    where: { id: req.patientId },
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                });
                if (!patient) {
                    res.status(404).json({ error: "Paciente não encontrado" });
                    return;
                }
                res.status(200).json(Object.assign(Object.assign({}, patient), { isAdmin: false }));
                return;
            }
            if (req.userId) {
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
                return;
            }
            res.status(401).json({ error: "Não autorizado" });
        }
        catch (error) {
            console.error("Erro ao buscar usuário:", error);
            res.status(500).json({ error: "Erro ao buscar usuário" });
        }
    }
    async checkUserType(req, res) {
        try {
            const { email } = req.body;
            console.log('Verificando tipo de usuário:', { email });
            const admin = await prisma.user.findUnique({ where: { email } });
            if (admin) {
                console.log('Usuário encontrado como admin');
                res.status(200).json({ type: 'admin' });
                return;
            }
            const patient = await prisma.patient.findUnique({ where: { email } });
            if (patient) {
                console.log('Usuário encontrado como paciente');
                res.status(200).json({ type: 'patient' });
                return;
            }
            console.log('Usuário não encontrado');
            res.status(404).json({ error: 'Usuário não encontrado' });
        }
        catch (error) {
            console.error('Erro ao verificar tipo de usuário:', error);
            res.status(500).json({ error: 'Erro ao verificar tipo de usuário' });
        }
    }
    async logout(req, res) {
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
        }
        catch (error) {
            console.error("Erro ao fazer logout:", error);
            res.status(500).json({ error: "Erro ao fazer logout" });
        }
    }
    async requestPasswordReset(req, res, next) {
        try {
            const { email } = req.body;
            if (!email) {
                const error = new Error("E-mail é obrigatório");
                error.statusCode = 400;
                return next(error);
            }
            const patient = await prisma.patient.findUnique({ where: { email } });
            if (!patient) {
                const error = new Error("Paciente não encontrado");
                error.statusCode = 404;
                return next(error);
            }
            const code = (0, verificationService_1.generateVerificationCode)();
            const expiresAt = new Date(Date.now() + 3600000);
            await prisma.patient.update({
                where: { email },
                data: {
                    emailVerificationCode: code,
                    emailVerificationExpires: expiresAt
                },
            });
            await prisma.$executeRaw `
        UPDATE "Patient"
        SET "passwordResetCode" = ${code},
            "passwordResetExpires" = ${expiresAt}
        WHERE email = ${email}
      `;
            try {
                await (0, verificationService_1.sendPasswordResetEmail)(email, code);
            }
            catch (emailError) {
                console.error("Erro ao enviar e-mail de redefinição:", emailError);
                const error = new Error("Erro ao enviar e-mail de redefinição");
                error.statusCode = 500;
                return next(error);
            }
            res.status(200).json({ message: "E-mail de redefinição de senha enviado" });
        }
        catch (error) {
            console.error("Erro ao solicitar redefinição de senha:", error);
            if (error instanceof Error) {
                const customError = error;
                res.status(customError.statusCode || 500).json({
                    error: customError.message || "Erro ao solicitar redefinição de senha"
                });
            }
            else {
                res.status(500).json({ error: "Erro ao solicitar redefinição de senha" });
            }
        }
    }
    async resendVerificationEmail(req, res, next) {
        try {
            const { email } = req.body;
            if (!email) {
                const error = new Error("E-mail é obrigatório");
                error.statusCode = 400;
                return next(error);
            }
            const patient = await prisma.patient.findUnique({ where: { email } });
            if (!patient) {
                const error = new Error("Paciente não encontrado");
                error.statusCode = 404;
                return next(error);
            }
            if (patient.isEmailVerified) {
                const error = new Error("E-mail já verificado");
                error.statusCode = 400;
                return next(error);
            }
            const code = (0, verificationService_1.generateVerificationCode)();
            const expiresAt = new Date(Date.now() + 3600000);
            await prisma.patient.update({
                where: { email },
                data: {
                    emailVerificationCode: code,
                    emailVerificationExpires: expiresAt
                },
            });
            await prisma.$executeRaw `
        UPDATE "Patient"
        SET "passwordResetCode" = ${code},
            "passwordResetExpires" = ${expiresAt}
        WHERE email = ${email}
      `;
            try {
                await (0, verificationService_1.sendVerificationEmail)(email, code);
            }
            catch (emailError) {
                console.error("Erro ao enviar e-mail de verificação:", emailError);
                const error = new Error("Erro ao enviar e-mail de verificação");
                error.statusCode = 500;
                return next(error);
            }
            res.status(200).json({ message: "E-mail de verificação reenviado" });
        }
        catch (error) {
            console.error("Erro ao reenviar e-mail de verificação:", error);
            if (error instanceof Error) {
                const customError = error;
                res.status(customError.statusCode || 500).json({
                    error: customError.message || "Erro ao reenviar e-mail de verificação"
                });
            }
            else {
                res.status(500).json({ error: "Erro ao reenviar e-mail de verificação" });
            }
        }
    }
    async refreshToken(req, res) {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                res.status(401).json({ error: "Refresh token não fornecido" });
                return;
            }
            const decoded = jsonwebtoken_1.default.verify(refreshToken, refreshTokenSecret);
            const hashedToken = crypto_1.default
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
            const { accessToken, refreshToken: newRefreshToken } = this.generateTokens(decoded.userId, decoded.isAdmin);
            await this.revokeRefreshToken(refreshToken);
            await this.saveRefreshToken(decoded.userId, null, newRefreshToken);
            this.setAuthCookies(res, accessToken, newRefreshToken);
            res.status(200).json({ message: "Tokens atualizados com sucesso" });
        }
        catch (error) {
            console.error("Erro ao atualizar tokens:", error);
            res.status(401).json({ error: "Erro ao atualizar tokens" });
        }
    }
    async getUserType(req, res) {
        try {
            const { email } = req.query;
            console.log('Verificando tipo de usuário:', { email });
            if (!email || typeof email !== 'string') {
                res.status(400).json({ error: 'Email é obrigatório' });
                return;
            }
            const user = await prisma.user.findUnique({ where: { email } });
            if (user) {
                console.log('Usuário encontrado como admin');
                res.status(200).json({ userType: 'admin' });
                return;
            }
            const patient = await prisma.patient.findUnique({ where: { email } });
            if (patient) {
                console.log('Usuário encontrado como paciente');
                res.status(200).json({ userType: 'patient' });
                return;
            }
            console.log('Usuário não encontrado');
            res.status(404).json({ error: 'Usuário não encontrado' });
        }
        catch (error) {
            console.error('Erro ao verificar tipo de usuário:', error);
            res.status(500).json({ error: 'Erro interno do servidor' });
        }
    }
}
exports.default = new AuthController();
