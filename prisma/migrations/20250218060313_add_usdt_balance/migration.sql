-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "token" TEXT NOT NULL DEFAULT 'TON';

-- AlterTable
ALTER TABLE "Wallet" ADD COLUMN     "usdtBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;
