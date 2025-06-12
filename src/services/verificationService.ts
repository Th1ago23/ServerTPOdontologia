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

export const sendPasswordResetEmail = async (email: string, code: string): Promise<void> => {
  try {
    const { sendEmail } = await import('./emailService');
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
  } catch (error) {
    console.error('Erro ao enviar e-mail de redefinição de senha:', error);
    throw new Error('Erro ao enviar e-mail de redefinição de senha');
  }
}; 