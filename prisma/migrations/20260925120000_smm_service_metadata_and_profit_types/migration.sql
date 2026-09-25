-- Reconciles the database with schema.prisma.
--
-- `serviceName`, `serviceCategory` and the SMM_PROFIT / ACCOUNTS_PROFIT
-- transaction types were added to schema.prisma without a matching migration,
-- so `prisma migrate status` reported "up to date" while the columns and enum
-- values were absent. The result was a hard runtime failure:
--   P2022 ColumnNotFound on prisma.smmOrder.findFirst (GET /api/smm/active -> 500)
-- and every SMM order's profit entry failing to write.
--
-- All changes are additive: two nullable columns and two enum values. No
-- existing rows are rewritten and no data is dropped.

-- AlterEnum
-- Internal-only transaction types for isolated profit shares. These are never
-- surfaced to customers. IF NOT EXISTS keeps the migration re-runnable.
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'SMM_PROFIT';
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'ACCOUNTS_PROFIT';

-- AlterTable
-- Display metadata for the boosting order history, so an order can be shown
-- with the service and platform it was bought for. Nullable, so the existing
-- rows keep working without a backfill.
ALTER TABLE "SmmOrder"
ADD COLUMN IF NOT EXISTS "serviceCategory" TEXT,
ADD COLUMN IF NOT EXISTS "serviceName" TEXT;

-- AddForeignKey
-- Presentational only: Prisma models this FK with ON UPDATE CASCADE, but the
-- original migration created it without that clause. Re-adding it idempotently
-- keeps `migrate diff` clean so genuine future drift is not masked.
ALTER TABLE "PasswordResetToken" DROP CONSTRAINT IF EXISTS "PasswordResetToken_userId_fkey";
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
