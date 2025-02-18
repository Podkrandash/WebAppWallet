/*
  Warnings:

  - Made the column `hash` on table `Transaction` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "hash" SET NOT NULL,
ALTER COLUMN "fee" DROP DEFAULT;
