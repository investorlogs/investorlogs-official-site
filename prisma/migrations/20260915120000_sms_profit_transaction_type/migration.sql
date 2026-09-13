-- AlterEnum
-- Adds an internal-only transaction type used to record the profit share
-- extracted from each SMS number sale. Never surfaced to customers.
ALTER TYPE "TransactionType" ADD VALUE 'SMS_PROFIT';
