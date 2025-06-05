import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const saltRounds = 10;

async function createAdmin() {
  const email = "tati.dent11@gmail.com";  // Defina um e-mail para o admin
  const password = "T4T1An3Th1ag0";        // Defina uma senha segura

  // Verifica se o usuário admin já existe
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    console.log("Usuário admin já existe.");
    return;
  }

  // Criptografa a senha do admin
  const hashedPassword = await bcrypt.hash(password, saltRounds);

  // Cria o usuário admin
  const newAdmin = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      isAdmin: true,
    },
  });

  console.log("Usuário admin criado com sucesso:", newAdmin);
  prisma.$disconnect();
}

createAdmin().catch((error) => {
  console.error("Erro ao criar admin:", error);
  prisma.$disconnect();
});
