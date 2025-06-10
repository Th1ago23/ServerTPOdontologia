import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

export const prisma = new PrismaClient();

export const clearDatabase = async () => {
  await prisma.$transaction([
    prisma.appointmentRequest.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.user.deleteMany(),
    prisma.doctor.deleteMany(),
  ]);
};

export const createTestUser = async () => {
  const hashedPassword = await bcrypt.hash('testpassword', 10);
  return await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: hashedPassword,
      isAdmin: true,
      isEmailVerified: true
    },
  });
};

export const createTestPatient = async () => {
  const hashedPassword = await bcrypt.hash('testpassword', 10);
  return await prisma.patient.create({
    data: {
      name: 'Test Patient',
      email: 'patient@example.com',
      password: hashedPassword,
      phone: '1234567890',
      birthDate: new Date(),
      address: 'Test Address',
      city: 'Test City',
      number: '123',
      state: 'Test State',
      zipCode: '12345-678',
      country: 'Test Country',
      cpf: '12345678900',
      isEmailVerified: true
    },
  });
}; 