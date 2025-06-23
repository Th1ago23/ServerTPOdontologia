/*
  Warnings:

  - You are about to drop the column `date` on the `AppointmentRequest` table. All the data in the column will be lost.
  - You are about to drop the column `time` on the `AppointmentRequest` table. All the data in the column will be lost.
  - Added the required column `requestedDate` to the `AppointmentRequest` table without a default value. This is not possible if the table is not empty.
  - Added the required column `requestedTime` to the `AppointmentRequest` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "AppointmentRequest" DROP COLUMN "date",
DROP COLUMN "time",
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "requestedDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "requestedTime" TEXT NOT NULL,
ADD COLUMN     "rescheduledAt" TIMESTAMP(3);
