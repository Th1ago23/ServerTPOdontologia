import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const saltRounds = 10;

async function createAdmin() {
  const email = "tati.dent11@gmail.com";  // Defina um e-mail para o admin
  const password = "T4T1An3Th1ag0";        // Defina uma senha segura

  
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
      isEmailVerified: true, // Email já verificado
    },
  });

  console.log("Usuário admin criado com sucesso:", newAdmin);
}

async function main() {
  await createAdmin();
  prisma.$disconnect();
}

main().catch((error) => {
  console.error("Erro ao executar seed:", error);
  prisma.$disconnect();
});
