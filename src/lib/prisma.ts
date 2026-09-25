import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * A connect attempt is abandoned after this many ms.
 *
 * `pg` defaults `connectionTimeoutMillis` to 0, which means "wait forever" and
 * defers to the operating system TCP connect timeout (~21s on Windows). When
 * the remote host (or a specific resolved address) black-holes packets, every
 * request blocks for that full period before failing. Bounding it here turns a
 * ~21s hang into a fast, retryable error.
 */
const CONNECTION_TIMEOUT_MS = 5_000

/** Keep the pool small: a serverless/pooled Postgres address charges per connection. */
const POOL_MAX = 10

/** Recycle idle clients so a long-lived dev server never sits on a stale socket. */
const POOL_IDLE_TIMEOUT_MS = 30_000

/**
 * Prisma Client singleton to avoid multiple instances during development
 * This is especially important in Next.js with hot reloading
 *
 * Prisma 7 requires a driver adapter for direct database connections.
 */
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and configure your PostgreSQL connection string."
    )
  }

  const adapter = new PrismaPg(
    {
      connectionString,
      max: POOL_MAX,
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
      // Never keep the process alive purely for an idle pool.
      allowExitOnIdle: true,
    },
    {
      // An idle client can die server-side at any time (pooler recycle, restart,
      // network blip). Without these handlers the 'error' event is unhandled and
      // takes the process down.
      onPoolError: (error) => {
        console.error("[prisma] idle pool client error:", error.message)
      },
      onConnectionError: (error) => {
        console.error("[prisma] connection error:", error.message)
      },
    }
  )

  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

/**
 * Error codes that represent a transient connectivity problem rather than a
 * bad query. Safe to retry: nothing was written.
 */
const TRANSIENT_DB_CODES = new Set([
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ENETDOWN",
  "EAI_AGAIN",
  // Postgres: connection failure / admin shutdown / cannot connect now
  "08000",
  "08001",
  "08003",
  "08006",
  "08004",
  "57P01",
  "57P02",
  "57P03",
  "53300",
])

function collectErrorCodes(error: unknown, depth = 0): string[] {
  if (!error || depth > 5) return []

  const codes: string[] = []
  const candidate = error as { code?: unknown; cause?: unknown }

  if (typeof candidate.code === "string") codes.push(candidate.code)
  if (candidate.cause) codes.push(...collectErrorCodes(candidate.cause, depth + 1))

  return codes
}

/** True when the failure is a connection-level glitch that a retry can clear. */
export function isTransientDbError(error: unknown): boolean {
  return collectErrorCodes(error).some((code) => TRANSIENT_DB_CODES.has(code))
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Runs a database read, retrying transient connection failures with a short
 * backoff. Used for non-critical reads (settings, catalogs) where a one-off
 * network blip should not surface as a user-facing error.
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  { retries = 2, baseDelayMs = 150 }: { retries?: number; baseDelayMs?: number } = {}
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      if (!isTransientDbError(error) || attempt === retries) throw error
      lastError = error
      console.warn(
        `[db] transient error on attempt ${attempt + 1}/${retries + 1}, retrying:`,
        collectErrorCodes(error).join(",") || "unknown"
      )
      await sleep(baseDelayMs * 2 ** attempt)
    }
  }

  throw lastError
}