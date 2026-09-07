-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'PURCHASE', 'REFUND');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('AVAILABLE', 'SOLD', 'RESERVED');

-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('PENDING', 'RECEIVED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SmmStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'CANCELLED', 'PARTIAL');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "walletBalance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "type" "TransactionType" NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DigitalAccount" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "credentials" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'AVAILABLE',
    "buyerId" TEXT,
    "purchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DigitalAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "orderId" TEXT,
    "code" TEXT,
    "status" "SmsStatus" NOT NULL DEFAULT 'PENDING',
    "price" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmmOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "targetLink" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "externalOrderId" TEXT,
    "status" "SmmStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmmOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_reference_key" ON "WalletTransaction"("reference");

-- CreateIndex
CREATE INDEX "WalletTransaction_userId_idx" ON "WalletTransaction"("userId");

-- CreateIndex
CREATE INDEX "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- CreateIndex
CREATE INDEX "WalletTransaction_status_idx" ON "WalletTransaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountCategory_slug_key" ON "AccountCategory"("slug");

-- CreateIndex
CREATE INDEX "AccountCategory_slug_idx" ON "AccountCategory"("slug");

-- CreateIndex
CREATE INDEX "DigitalAccount_categoryId_idx" ON "DigitalAccount"("categoryId");

-- CreateIndex
CREATE INDEX "DigitalAccount_status_idx" ON "DigitalAccount"("status");

-- CreateIndex
CREATE INDEX "DigitalAccount_buyerId_idx" ON "DigitalAccount"("buyerId");

-- CreateIndex
CREATE INDEX "SmsOrder_userId_idx" ON "SmsOrder"("userId");

-- CreateIndex
CREATE INDEX "SmsOrder_status_idx" ON "SmsOrder"("status");

-- CreateIndex
CREATE INDEX "SmsOrder_orderId_idx" ON "SmsOrder"("orderId");

-- CreateIndex
CREATE INDEX "SmmOrder_userId_idx" ON "SmmOrder"("userId");

-- CreateIndex
CREATE INDEX "SmmOrder_status_idx" ON "SmmOrder"("status");

-- CreateIndex
CREATE INDEX "SmmOrder_externalOrderId_idx" ON "SmmOrder"("externalOrderId");

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalAccount" ADD CONSTRAINT "DigitalAccount_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "AccountCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DigitalAccount" ADD CONSTRAINT "DigitalAccount_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsOrder" ADD CONSTRAINT "SmsOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmmOrder" ADD CONSTRAINT "SmmOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
