import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkAdmin() {
  try {
    const admin = await prisma.user.findUnique({
      where: { email: 'tati.dent11@gmail.com' }
    });
    
    console.log('Admin encontrado:', admin);
    
    if (admin) {
      console.log('Email verificado:', admin.isEmailVerified);
      console.log('É admin:', admin.isAdmin);
    }
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAdmin(); 