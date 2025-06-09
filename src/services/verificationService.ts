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

export const createVerificationCode = async (email: string, isAdmin: boolean = false) => {
  const code = generateVerificationCode();
  const expiresAt = new Date(Date.now() + 3600000); // 1 hora

  if (isAdmin) {
    await prisma.user.update({
      where: { email },
      data: {
        emailVerificationCode: code,
        emailVerificationExpires: expiresAt,
      },
    });
  } else {
    await prisma.patient.update({
      where: { email },
      data: {
        emailVerificationCode: code,
        emailVerificationExpires: expiresAt,
      },
    });
  }

  await sendVerificationEmail(email, code);
  return code;
};

export const verifyCode = async (email: string, code: string, isAdmin: boolean = false) => {
  const now = new Date();

  if (isAdmin) {
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.emailVerificationCode || !user.emailVerificationExpires) {
      throw new Error('Código de verificação não encontrado');
    }

    if (user.emailVerificationCode !== code) {
      throw new Error('Código de verificação inválido');
    }

    if (user.emailVerificationExpires < now) {
      throw new Error('Código de verificação expirado');
    }

    await prisma.user.update({
      where: { email },
      data: {
        isEmailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
      },
    });
  } else {
    const patient = await prisma.patient.findUnique({
      where: { email },
    });

    if (!patient || !patient.emailVerificationCode || !patient.emailVerificationExpires) {
      throw new Error('Código de verificação não encontrado');
    }

    if (patient.emailVerificationCode !== code) {
      throw new Error('Código de verificação inválido');
    }

    if (patient.emailVerificationExpires < now) {
      throw new Error('Código de verificação expirado');
    }

    await prisma.patient.update({
      where: { email },
      data: {
        isEmailVerified: true,
        emailVerificationCode: null,
        emailVerificationExpires: null,
      },
    });
  }

  return true;
}; 