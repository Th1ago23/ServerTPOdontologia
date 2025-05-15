"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma = new client_1.PrismaClient();
const saltRounds = 10;
const jwtSecret = process.env.JWT_SECRET || "JWT_SECRET"; // Use uma variável de ambiente segura
class AuthController {
    async registerUser(req, res) {
        try {
            const { email, password } = req.body;
            const existingUser = await prisma.user.findUnique({ where: { email } });
            if (existingUser) {
                res.status(400).json({ error: "Usuário já cadastrado" });
                return;
            }
            const hashedPassword = await bcrypt_1.default.hash(password, saltRounds);
            const newUser = await prisma.user.create({ data: { email, password: hashedPassword, isAdmin: true } });
            res.status(201).json({ message: "Usuário registrado com sucesso", userId: newUser.id, email: newUser.email });
        }
        catch (error) {
            console.error("Erro ao registrar usuário:", error);
            res.status(500).json({ error: "Erro ao registrar usuário" });
        }
    }
    async loginUser(req, res) {
        try {
            const { email, password } = req.body;
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user || !(await bcrypt_1.default.compare(password, user.password))) {
                res.status(401).json({ error: "Credenciais inválidas" });
                return;
            }
            const token = jsonwebtoken_1.default.sign({ userId: user.id, isAdmin: user.isAdmin }, jwtSecret, { expiresIn: "1h" });
            res.status(200).json({
                token,
                user: {
                    id: user.id,
                    email: user.email,
                    isAdmin: user.isAdmin
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
            const { name, email, cpf, phone, birthDate, address, city, state, zipCode, country, password, number, complement } = req.body;
            // Verificações
            const existingPatientByEmail = await prisma.patient.findUnique({ where: { email } });
            if (existingPatientByEmail) {
                const error = new Error("Paciente com este e-mail já cadastrado");
                error.statusCode = 400;
                return next(error);
            }
            const existingPatientByCpf = await prisma.patient.findUnique({ where: { cpf } });
            if (existingPatientByCpf) {
                const error = new Error("Paciente com este CPF já cadastrado");
                error.statusCode = 400;
                return next(error);
            }
            const existingPatientByPhone = await prisma.patient.findUnique({ where: { phone } });
            if (existingPatientByPhone) {
                const error = new Error("Paciente com este número de telefone já cadastrado");
                error.statusCode = 400;
                return next(error);
            }
            // Criação do paciente
            const hashedPassword = await bcrypt_1.default.hash(password, saltRounds);
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
            const token = jsonwebtoken_1.default.sign({ id: patient.id, email: patient.email }, process.env.JWT_SECRET, {
                expiresIn: "1d",
            });
            // Retorna já logado
            res.status(201).json({
                message: "Paciente registrado com sucesso",
                token,
                patientId: patient.id,
            });
        }
        catch (error) {
            console.error("Erro ao registrar paciente:", error);
            return next(error);
        }
    }
    async loginPatient(req, res, next) {
        try {
            const { email, password } = req.body;
            const patient = await prisma.patient.findUnique({ where: { email } });
            if (!patient || !(await bcrypt_1.default.compare(password, patient.password))) {
                const error = new Error("Credenciais inválidas");
                error.statusCode = 401;
                return next(error);
            }
            const token = jsonwebtoken_1.default.sign({ patientId: patient.id, }, jwtSecret, { expiresIn: "1h" });
            res.status(200).json({
                token,
                patientId: patient.id,
                message: "Login realizado com sucesso",
            });
        }
        catch (error) {
            console.error("Erro ao fazer login do paciente:", error);
            return next(error);
        }
    }
    async me(req, res, next) {
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
                }
                else {
                    res.status(404).json({ error: "Usuário não encontrado" });
                    return; // Indica que a função terminou aqui
                }
            }
            else if (!isAdmin && patientId) {
                const patient = await prisma.patient.findUnique({
                    where: { id: patientId },
                    select: { id: true, name: true, email: true, phone: true, cpf: true, birthDate: true, address: true, number: true, complement: true, city: true, state: true, zipCode: true, country: true, createdAt: true },
                });
                if (patient) {
                    res.status(200).json(patient);
                    return; // Indica que a função terminou aqui
                }
                else {
                    res.status(404).json({ error: "Paciente não encontrado" });
                    return; // Indica que a função terminou aqui
                }
            }
            res.status(400).json({ error: "Tipo de usuário inválido no token" });
            return; // Indica que a função terminou aqui
        }
        catch (error) {
            console.error("Erro ao buscar dados do usuário/paciente:", error);
            return next(error); // Passa o erro para o middleware de tratamento de erros
        }
    }
}
exports.default = new AuthController();
