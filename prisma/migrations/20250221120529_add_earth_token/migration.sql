-- AlterEnum
ALTER TYPE "TokenType" ADD VALUE 'EARTH';

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "earthBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
