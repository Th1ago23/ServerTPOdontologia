import { PrismaClient } from '@prisma/client';
import { sendEmail } from './emailService';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const generateVerificationCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

export const sendVerificationEmail = async (email: string, code: string) => {
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

  await sendEmail({
    to: email,
    subject: 'Código de Verificação - TP Odontologia',
    text: emailText,
    html: emailHtml,
  });
};

export const createVerificationCode = async (email: string, isPatient: boolean = false) => {
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 3600000); // 1 hora

  if (isPatient) {
    // Primeiro verifica se o paciente existe
    const patient = await prisma.patient.findUnique({
      where: { email },
    });

    if (!patient) {
      throw new Error('Paciente não encontrado');
    }

    // Se existir, atualiza o código
    await prisma.patient.update({
      where: { email },
      data: {
        emailVerificationCode: code,
        emailVerificationExpires: expiresAt,
      },
    });

    await sendVerificationEmail(email, code);
  } else {
    // Primeiro verifica se o usuário existe
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Se existir, atualiza o código
    await prisma.user.update({
      where: { email },
      data: {
        emailVerificationCode: code,
        emailVerificationExpires: expiresAt,
      },
    });

    await sendVerificationEmail(email, code);
  }

  return code;
};

export const verifyEmail = async (email: string, code: string): Promise<{ success: boolean; message: string }> => {
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
  } catch (error) {
    console.error("Erro ao verificar e-mail:", error);
    throw new Error("Erro ao verificar e-mail");
  }
}; 