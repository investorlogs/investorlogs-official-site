-- Phase 6: Password reset tokens (single-use, expire after 1 hour)
CREATE TABLE "PasswordResetToken" (
    "id"         TEXT NOT NULL,
    "userId"     TEXT NOT NULL,
    "token"      TEXT NOT NULL,
    "expiresAt"  TIMESTAMP(3) NOT NULL,
    "usedAt"     TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PasswordResetToken_token_key" UNIQUE ("token"),
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE
);

CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken" ("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken" ("expiresAt");