-- Add isBanned column to User table.
-- The Prisma schema includes isBanned (model User, line 21) but the initial
-- migration never created it. This migration brings the database in line with
-- the schema so Prisma queries stop failing with P2022.
ALTER TABLE "User" ADD COLUMN "isBanned" BOOLEAN NOT NULL DEFAULT false;