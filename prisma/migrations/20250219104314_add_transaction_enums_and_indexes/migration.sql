/*
  Warnings:

  - The `status` column on the `Transaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `token` column on the `Transaction` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[hash]` on the table `Transaction` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `type` on the `Transaction` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Made the column `address` on table `Transaction` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TokenType" AS ENUM ('TON', 'USDT');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "error" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "TransactionType" NOT NULL,
ALTER COLUMN "address" SET NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
ALTER COLUMN "fee" SET DEFAULT 0,
DROP COLUMN "token",
ADD COLUMN     "token" "TokenType" NOT NULL DEFAULT 'TON';

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_hash_key" ON "Transaction"("hash");

-- CreateIndex
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_timestamp_idx" ON "Transaction"("timestamp");

-- CreateIndex
CREATE INDEX "Transaction_hash_idx" ON "Transaction"("hash");

-- CreateIndex
CREATE INDEX "User_telegramId_idx" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE INDEX "Wallet_address_idx" ON "Wallet"("address");
