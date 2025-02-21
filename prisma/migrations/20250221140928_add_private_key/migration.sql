/*
  Warnings:

  - You are about to drop the column `encryptedKey` on the `Wallet` table. All the data in the column will be lost.
  - Added the required column `privateKey` to the `Wallet` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN "privateKey" TEXT;

-- Копируем данные из старой колонки в новую
UPDATE "Wallet" SET "privateKey" = "encryptedKey";

-- Делаем новую колонку NOT NULL
ALTER TABLE "Wallet" ALTER COLUMN "privateKey" SET NOT NULL;

-- Удаляем старую колонку
ALTER TABLE "Wallet" DROP COLUMN "encryptedKey";
