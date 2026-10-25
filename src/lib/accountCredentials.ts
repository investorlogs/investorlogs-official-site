import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"

/**
 * App-level encryption for sold account credentials (DigitalAccount.credentials).
 *
 * Why this exists: purchased logins are the most sensitive customer data in the
 * database. Postgres encryption-at-rest protects the disk, but anyone with a DB
 * connection (breach, backup, SQL console) still reads them. AES-256-GCM here
 * means the database only ever holds ciphertext — the key lives in the
 * environment, never in the DB.
 *
 * Envelope format: `enc:v1:<base64(iv‖ciphertext‖authTag)>`.
 * The `enc:v1:` prefix lets readers distinguish ciphertext from legacy
 * plaintext rows so old stock keeps working until it sells through
 * (decryptCredential falls back to returning the raw value when the prefix
 * is absent — see below). New writes must ALWAYS go through encryptCredential.
 */

const PREFIX = "enc:v1:"
const ALGORITHM = "aes-256-gcm"
const IV_BYTES = 12

function getKey(): Buffer {
  const raw = process.env.CREDENTIALS_SECRET?.trim()
  if (!raw) {
    throw new Error(
      "CREDENTIALS_SECRET is not set. Generate one with " +
        "`node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"` " +
        "and add it to .env / Vercel env vars. Credential writes are refused without it."
    )
  }
  const key = Buffer.from(raw, "hex")
  if (key.length !== 32) {
    throw new Error(
      "CREDENTIALS_SECRET must be 32 bytes as hex (64 hex chars). " +
        `Got ${key.length} bytes.`
    )
  }
  return key
}

export function isEncryptedCredential(value: string): boolean {
  return value.startsWith(PREFIX)
}

/** Encrypts a plaintext credential block for storage. Throws without a valid key. */
export function encryptCredential(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return PREFIX + Buffer.concat([iv, ciphertext, tag]).toString("base64")
}

/**
 * Decrypts a stored credential for the owning customer.
 * Legacy plaintext rows (no `enc:v1:` prefix) are returned as-is so old stock
 * keeps working; every NEW write is ciphertext (see encryptCredential).
 */
export function decryptCredential(stored: string): string {
  if (!isEncryptedCredential(stored)) return stored
  const key = getKey()
  const blob = Buffer.from(stored.slice(PREFIX.length), "base64")
  const iv = blob.subarray(0, IV_BYTES)
  const tag = blob.subarray(blob.length - 16)
  const ciphertext = blob.subarray(IV_BYTES, blob.length - 16)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8")
}
