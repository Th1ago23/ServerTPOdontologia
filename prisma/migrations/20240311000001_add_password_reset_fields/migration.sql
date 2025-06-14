-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "passwordResetCode" TEXT,
ADD COLUMN "passwordResetExpires" TIMESTAMP(3); 