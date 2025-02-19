-- DropIndex
DROP INDEX "Transaction_hash_userId_key";

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "hash" DROP NOT NULL;
