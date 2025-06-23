"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = exports.verifyEmail = exports.sendVerificationEmail = exports.generateVerificationCode = void 0;
const client_1 = require("@prisma/client");
const emailService_1 = require("./emailService");
const crypto_1 = __importDefault(require("crypto"));
const prisma = new client_1.PrismaClient();
const generateVerificationCode = () => {
    return crypto_1.default.randomInt(100000, 999999).toString();
};
exports.generateVerificationCode = generateVerificationCode;
const sendVerificationEmail = async (email, code) => {
    const emailText = `
    Seu código de verificação é: ${code}
    
    Este código expirará em 1 hora.
    
    Se você não solicitou este código, por favor ignore este e-mail.
  `;
    const emailHtml = `
    <h2>Verificação de E-mail</h2>
    <p>Seu código de verificação é: <strong>${code}</strong></p>
    <p>Este código expirará em 1 hora.</p>
    <p>Se você não solicitou este código, por favor ignore este e-mail.</p>
  `;
    await (0, emailService_1.sendEmail)({
        to: email,
        subject: 'Código de Verificação - TP Odontologia',
        text: emailText,
        html: emailHtml,
    });
};
exports.sendVerificationEmail = sendVerificationEmail;
const verifyEmail = async (email, code) => {
    try {
        const patient = await prisma.patient.findUnique({
            where: { email },
            select: {
                id: true,
                emailVerificationCode: true,
                emailVerificationExpires: true,
                isEmailVerified: true
            }
        });
        if (!patient) {
            return {
                success: false,
                message: "Paciente não encontrado"
            };
        }
        if (patient.isEmailVerified) {
            return {
                success: false,
                message: "E-mail já verificado"
            };
        }
        if (!patient.emailVerificationCode) {
            return {
                success: false,
                message: "Código de verificação não encontrado. Por favor, solicite um novo código."
            };
        }
        if (patient.emailVerificationCode !== code) {
            return {
                success: false,
                message: "Código de verificação inválido"
            };
        }
        if (patient.emailVerificationExpires && patient.emailVerificationExpires < new Date()) {
            return {
                success: false,
                message: "Código de verificação expirado. Por favor, solicite um novo código."
            };
        }
        await prisma.patient.update({
            where: { id: patient.id },
            data: {
                isEmailVerified: true,
                emailVerificationCode: null,
                emailVerificationExpires: null
            }
        });
        return {
            success: true,
            message: "E-mail verificado com sucesso"
        };
    }
    catch (error) {
        console.error("Erro ao verificar e-mail:", error);
        throw new Error("Erro ao verificar e-mail");
    }
};
exports.verifyEmail = verifyEmail;
const sendPasswordResetEmail = async (email, code) => {
    try {
        const { sendEmail } = await Promise.resolve().then(() => __importStar(require('./emailService')));
        await sendEmail({
            to: email,
            subject: 'Redefinição de Senha - TP Odontologia',
            text: `Seu código de redefinição de senha é: ${code}. Este código expira em 1 hora.`,
            html: `
        <h2>Redefinição de Senha</h2>
        <p>Seu código de redefinição de senha é: <strong>${code}</strong></p>
        <p>Este código expira em 1 hora.</p>
        <p>Se você não solicitou a redefinição de senha, ignore este e-mail.</p>
      `
        });
    }
    catch (error) {
        console.error('Erro ao enviar e-mail de redefinição de senha:', error);
        throw new Error('Erro ao enviar e-mail de redefinição de senha');
    }
};
exports.sendPasswordResetEmail = sendPasswordResetEmail;
