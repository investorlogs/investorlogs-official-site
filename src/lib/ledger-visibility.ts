import { TransactionType } from "@/generated/prisma/client"

/**
 * Ledger rows the customer must never see.
 *
 * SMS_PROFIT / SMM_PROFIT / ACCOUNTS_PROFIT are the platform's own margin
 * ledger: each sale writes a customer-facing PURCHASE/DEPOSIT row AND a
 * same-user profit row for internal earnings reporting. They share the
 * customer's userId, so any unfiltered `where: { userId }` listing leaks the
 * exact markup taken on their order and breaks white-labeling.
 *
 * Every customer-facing transaction query MUST add:
 *   type: { notIn: CUSTOMER_HIDDEN_TRANSACTION_TYPES }
 */
export const CUSTOMER_HIDDEN_TRANSACTION_TYPES: TransactionType[] = [
  "SMS_PROFIT",
  "SMM_PROFIT",
  "ACCOUNTS_PROFIT",
]
