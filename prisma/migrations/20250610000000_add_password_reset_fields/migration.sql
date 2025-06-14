-- Adiciona campos de reset de senha
ALTER TABLE "Patient" ADD COLUMN "passwordResetCode" TEXT;
ALTER TABLE "Patient" ADD COLUMN "passwordResetExpires" TIMESTAMP(3); 