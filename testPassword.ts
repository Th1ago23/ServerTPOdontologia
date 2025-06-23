import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testPassword() {
  try {
    const admin = await prisma.user.findUnique({
      where: { email: 'tati.dent11@gmail.com' }
    });
    
    if (!admin) {
      console.log('Admin não encontrado');
      return;
    }
    
    const testPassword = 'T4T1An3Th1ag0';
    const passwordMatch = await bcrypt.compare(testPassword, admin.password);
    
    console.log('Senha testada:', testPassword);
    console.log('Senha corresponde:', passwordMatch);
    
    // Testar com outras variações
    const variations = [
      'T4T1An3Th1ag0',
      'T4T1An3Th1ag0!',
      'T4T1An3Th1ag0@',
      'T4T1An3Th1ag0#',
      'T4T1An3Th1ag0$',
      'T4T1An3Th1ag0%',
      'T4T1An3Th1ag0^',
      'T4T1An3Th1ag0&',
      'T4T1An3Th1ag0*',
      'T4T1An3Th1ag0(',
      'T4T1An3Th1ag0)',
      'T4T1An3Th1ag0-',
      'T4T1An3Th1ag0_',
      'T4T1An3Th1ag0+',
      'T4T1An3Th1ag0=',
      'T4T1An3Th1ag0[',
      'T4T1An3Th1ag0]',
      'T4T1An3Th1ag0{',
      'T4T1An3Th1ag0}',
      'T4T1An3Th1ag0|',
      'T4T1An3Th1ag0\\',
      'T4T1An3Th1ag0:',
      'T4T1An3Th1ag0;',
      'T4T1An3Th1ag0"',
      'T4T1An3Th1ag0\'',
      'T4T1An3Th1ag0<',
      'T4T1An3Th1ag0>',
      'T4T1An3Th1ag0,',
      'T4T1An3Th1ag0.',
      'T4T1An3Th1ag0?',
      'T4T1An3Th1ag0/',
      'T4T1An3Th1ag0 ',
      'T4T1An3Th1ag0\t',
      'T4T1An3Th1ag0\n',
      'T4T1An3Th1ag0\r'
    ];
    
    for (const variation of variations) {
      const match = await bcrypt.compare(variation, admin.password);
      if (match) {
        console.log('Senha encontrada:', JSON.stringify(variation));
        break;
      }
    }
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPassword(); 